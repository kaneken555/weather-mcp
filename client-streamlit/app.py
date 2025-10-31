# client-streamlit/app.py
import os
import json
import time
import requests
import streamlit as st
from sseclient import SSEClient
from dotenv import load_dotenv

# ============ 設定読み込み(.env) ============
# 親ディレクトリの .env を明示的にロード
load_dotenv(dotenv_path="../.env")
SERVER = os.getenv("SERVER", "http://localhost:3000")

# ============ Streamlit 設定 ============
st.set_page_config(page_title="weather-mcp client", page_icon="🌤️", layout="centered")
st.title("🌤️ weather-mcp client")
st.caption("JSON-RPC + SSE で MCP サーバ（weather-mcp）と通信します。")
st.write(f"**接続先サーバ**: `{SERVER}`")

# ============ ユーティリティ ============
def read_sse(n: int = 1, timeout: int = 10):
    """
    /sse に1回だけ接続し、最大 n 件のイベントを受信して返す。
    受信後は必ず接続をクローズする。
    """
    try:
        resp = requests.get(f"{SERVER}/sse", stream=True, timeout=timeout)
        client = SSEClient(resp)
    except Exception as e:
        raise RuntimeError(f"SSE接続に失敗: {e}") from e

    events = []
    try:
        for idx, evt in enumerate(client.events()):
            events.append(evt)
            if idx + 1 >= n:
                break
        return events
    finally:
        try:
            client.close()
        except Exception:
            pass
        try:
            resp.close()
        except Exception:
            pass


def call_tool_jsonrpc(tool: str, input_payload: dict, timeout: int = 30):
    """
    JSON-RPCで /tools/call にPOST。
    戻り値はサーバのJSONをそのまま返す。
    """
    payload = {
        "jsonrpc": "2.0",
        "id": f"{tool}-{int(time.time())}",
        "method": "tools/call",
        "params": {
            "tool": tool,
            "input": input_payload,
        },
    }
    r = requests.post(f"{SERVER}/tools/call", json=payload, timeout=timeout)
    r.raise_for_status()
    return r.json()


# ============ UI: SSE（ツール一覧） ============
st.subheader("🔄 ツール一覧（SSE）")
col1, col2 = st.columns(2)
with col1:
    if st.button("SSEで1イベントだけ取得"):
        try:
            events = read_sse(n=1, timeout=10)
            if not events:
                st.warning("イベントを受信できませんでした。")
            else:
                evt = events[0]
                st.write(f"**event:** `{evt.event}`")
                try:
                    data = json.loads(evt.data)
                    st.json(data)
                except Exception:
                    st.code(evt.data)
        except Exception as e:
            st.error(str(e))

with col2:
    with st.expander("Tips: SSEの使い方"):
        st.markdown(
            "- `requests.get(..., stream=True)` でHTTPストリームを開き、`SSEClient(resp)` に渡す\n"
            "- 反復は **`client.events()`** で行う（`SSEClient` を直接 `for` で回さない）\n"
            "- 使い終わったら `client.close()` / `resp.close()` で明示的にクローズ"
        )

st.markdown("---")

# ============ UI: ツール呼び出し（JSON-RPC） ============
st.subheader("🛠️ ツール呼び出し（JSON-RPC）")

tool = st.selectbox(
    "ツールを選択",
    ["get_current_weather", "get_daily_forecast"],
    help="weather-mcp のツールを選択します",
)

with st.form("tool_call"):
    colA, colB = st.columns(2)
    with colA:
        city = st.text_input("city（任意）", placeholder="例: Tokyo")
        units = st.selectbox("units", ["metric", "imperial", "standard"], index=0)
        lang = st.text_input("lang", value="ja")
    with colB:
        use_latlon = st.checkbox("lat/lon を使う", value=False)
        lat = st.number_input("lat（任意）", value=35.680, format="%.6f")
        lon = st.number_input("lon（任意）", value=139.769, format="%.6f")

    if tool == "get_daily_forecast":
        days = st.slider("days（1〜7）", min_value=1, max_value=7, value=3)

    submitted = st.form_submit_button("実行")

if submitted:
    # 入力組み立て
    base = {"units": units, "lang": lang}
    if use_latlon:
        payload = base | {"lat": float(lat), "lon": float(lon)}
    else:
        payload = base | {"city": city}

    if tool == "get_daily_forecast":
        payload |= {"days": int(days)}  # 指定があればそのまま、なければサーバ側のdefaultが効く

    # 呼び出し
    try:
        res = call_tool_jsonrpc(tool, payload, timeout=30)
        st.success("✅ 成功")
        st.json(res)
    except requests.HTTPError as he:
        st.error(f"HTTPError: {he}\n\n{getattr(he, 'response', None) and getattr(he.response, 'text', '')}")
    except Exception as e:
        st.error(f"エラー: {e}")

st.markdown("---")

with st.expander("ℹ️ 接続設定 / デバッグ"):
    st.write("`.env` からロードされた設定")
    st.code(
        f"SERVER={SERVER}\n"
        "※ .env はプロジェクト直下（weather-mcp/.env）に配置。"
        "\n例：\n"
        "PORT=3000\n"
        "OPENWEATHER_KEY=xxxxxxxx\n"
        "DEFAULT_UNITS=metric\n"
        "DEFAULT_LANG=ja\n"
        "SERVER=http://localhost:3000\n",
        language="bash",
    )
