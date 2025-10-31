import axios from "axios";
import { z } from "zod";
import {
  GetCurrentWeatherInput, CurrentWeatherOutput,
  GetDailyForecastInput, DailyForecastOutput
} from "../schemas";

const BASE = "https://api.openweathermap.org/data/2.5";

function buildParams(input: { city?: string; lat?: number; lon?: number; units?: string; lang?: string }) {
  const params: any = {
    appid: process.env.OPENWEATHER_KEY,
    units: input.units ?? process.env.DEFAULT_UNITS ?? "metric",
    lang: input.lang ?? process.env.DEFAULT_LANG ?? "en",
  };
  if (input.city) params.q = input.city;
  if (input.lat != null && input.lon != null) { params.lat = input.lat; params.lon = input.lon; }
  return params;
}

export const weatherTools = [
  {
    name: "get_current_weather",
    title: "Get Current Weather",
    description: "現在の天気（都市名 or 緯度経度で指定）を返します",
    inputSchema: GetCurrentWeatherInput,
    outputSchema: CurrentWeatherOutput,
    handler: async (input: z.infer<typeof GetCurrentWeatherInput>) => {
      const params = buildParams(input);
      const { data } = await axios.get(`${BASE}/weather`, { params });
      return CurrentWeatherOutput.parse(data);
    },
  },
  {
    name: "get_daily_forecast",
    title: "Get Daily Forecast",
    description: "3〜7日分の日次予報（最高/最低/要約）を返します",
    inputSchema: GetDailyForecastInput,
    outputSchema: DailyForecastOutput,
    handler: async (input: z.infer<typeof GetDailyForecastInput>) => {
      // OpenWeatherの「/forecast」は3時間刻み → 簡易的に日単位に集約
      const params = buildParams(input);
      const { data } = await axios.get(`${BASE}/forecast`, { params });
      // 集約（超簡易）：日付ごとにmin/max/最頻出の説明を拾う
      const byDate: Record<string, { mins: number[]; maxs: number[]; descs: string[] }> = {};
      for (const item of data.list as any[]) {
        const date = (item.dt_txt as string).slice(0, 10);
        const t = item.main.temp as number;
        const desc = item.weather?.[0]?.description ?? "";
        if (!byDate[date]) byDate[date] = { mins: [], maxs: [], descs: [] };
        byDate[date].mins.push(t);
        byDate[date].maxs.push(t);
        byDate[date].descs.push(desc);
      }
      const pickMode = (arr: string[]) =>
        arr.sort((a,b) => arr.filter(v=>v===a).length - arr.filter(v=>v===b).length).pop() ?? "";

      const days = Object.entries(byDate)
        .slice(0, Math.max(1, input.days ?? 3))
        .map(([date, agg]) => ({
          date,
          temp_min: Math.min(...agg.mins),
          temp_max: Math.max(...agg.maxs),
          summary: pickMode(agg.descs),
        }));

      return DailyForecastOutput.parse({
        location: { name: data.city?.name ?? input.city ?? "unknown", lat: data.city?.coord?.lat, lon: data.city?.coord?.lon },
        days,
      });
    },
  },
];
