import { z } from "zod";

export const GetCurrentWeatherInput = z.object({
  city: z.string().min(1).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  units: z.enum(["standard", "metric", "imperial"]).optional(),
  lang: z.string().optional(), // e.g. "ja"
}).refine(i => !!i.city || (i.lat != null && i.lon != null), {
  message: "city か lat/lon のどちらかを指定してください",
});

export const CurrentWeatherOutput = z.object({
  name: z.string(),
  coord: z.object({ lat: z.number(), lon: z.number() }),
  weather: z.array(z.object({
    main: z.string(),
    description: z.string(),
  })),
  main: z.object({
    temp: z.number(),
    feels_like: z.number(),
    humidity: z.number(),
  }),
  wind: z.object({ speed: z.number() }),
  dt: z.number(), // unix
  sys: z.object({ country: z.string().optional() }).optional(),
});

export type GetCurrentWeatherInputT = z.infer<typeof GetCurrentWeatherInput>;
export type CurrentWeatherOutputT = z.infer<typeof CurrentWeatherOutput>;

export const GetDailyForecastInput = z.object({
  city: z.string().min(1).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  days: z.number().min(1).max(7).default(3),
  units: z.enum(["standard", "metric", "imperial"]).optional(),
  lang: z.string().optional(),
}).refine(i => !!i.city || (i.lat != null && i.lon != null), {
  message: "city か lat/lon のどちらかを指定してください",
});

export const DailyForecastOutput = z.object({
  location: z.object({ name: z.string(), lat: z.number(), lon: z.number() }),
  days: z.array(z.object({
    date: z.string(),           // ISO
    temp_min: z.number(),
    temp_max: z.number(),
    summary: z.string(),
  })),
});
