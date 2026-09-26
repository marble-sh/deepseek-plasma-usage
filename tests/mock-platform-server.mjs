/*
    Dev-only mock of the DeepSeek platform API, used to verify the widget's
    rich mode end to end without live credentials. Serves the payload shapes
    recorded in docs/state/api-contract.md.

    Usage: node tests/mock-platform-server.mjs [port]
    Point `PLATFORM_BASE` in contents/ui/js/api.js at it to exercise rich mode
    without live credentials (restore the constant afterwards).
*/
import http from "node:http";

const port = Number(process.argv[2] || 8731);

const KEYS = [
    { tracking_id: "4ec071d2-bed7-404d-86b0-0c88900afd17", name: "home", sensitive_id: "sk-436d4***********************b3be" },
    { tracking_id: "0f649568-18d5-4470-ac2c-fdec74be771f", name: "zed-vapor", sensitive_id: "sk-68cc7***********************fa4f" },
    { tracking_id: "a6ee9503-ac2c-49b2-8fee-b0b41b298e63", name: "zed-air", sensitive_id: "sk-f18a0***********************e6e7" }
];

function localMidnight(daysBack) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysBack);
    return Math.floor(d.getTime() / 1000);
}

// Deterministic pseudo-random spend so screenshots are stable.
function pseudo(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

const DAYS = 30;

function costPayload() {
    const data = KEYS.map((key, k) => ({
        currency: "USD",
        series: [{
            api_key: { ...key, valid: true, key_type: "NORMAL" },
            model: k === 1 ? "deepseek-v4-pro" : "deepseek-flash",
            buckets: Array.from({ length: DAYS }, (_, i) => {
                const daysBack = DAYS - 1 - i;
                const weight = k === 0 ? 0.35 : k === 1 ? 1 : 0.15;
                const cost = pseudo(daysBack * 7 + k * 3) * 0.9 * weight;
                return { time: localMidnight(daysBack), cost: cost.toFixed(16) };
            })
        }]
    }));
    return {
        code: 0,
        msg: "",
        data: {
            biz_code: 0,
            biz_msg: "",
            biz_data: {
                start: localMidnight(DAYS - 1),
                end: localMidnight(-1),
                bucket: 86400,
                models: ["deepseek-flash", "deepseek-v4-pro"],
                data
            }
        }
    };
}

function amountPayload() {
    const series = KEYS.map((key, k) => ({
        api_key: { ...key, valid: true, key_type: "NORMAL" },
        model: k === 1 ? "deepseek-v4-pro" : "deepseek-flash",
        buckets: Array.from({ length: DAYS }, (_, i) => {
            const daysBack = DAYS - 1 - i;
            const weight = k === 0 ? 0.35 : k === 1 ? 1 : 0.15;
            const r = pseudo(daysBack * 3 + k);
            const cacheHit = Math.round(r * 40_000_000 * weight);
            const cacheMiss = Math.round(r * 1_500_000 * weight);
            const response = Math.round(r * 450_000 * weight);
            const requests = Math.round(r * 300 * weight);
            return {
                time: localMidnight(daysBack),
                usage: {
                    RESPONSE_TOKEN: response,
                    REQUEST: requests,
                    PROMPT_CACHE_HIT_TOKEN: cacheHit,
                    PROMPT_CACHE_MISS_TOKEN: cacheMiss
                }
            };
        })
    }));
    return {
        code: 0,
        msg: "",
        data: {
            biz_code: 0,
            biz_msg: "",
            biz_data: {
                start: localMidnight(DAYS - 1),
                end: localMidnight(-1),
                bucket: 86400,
                models: ["deepseek-flash", "deepseek-v4-pro"],
                series
            }
        }
    };
}

function summaryPayload() {
    return {
        code: 0,
        msg: "",
        data: {
            biz_code: 0,
            biz_msg: "",
            biz_data: {
                normal_wallets: [{ currency: "USD", balance: "7.4802165840000000", token_estimation: "0" }],
                bonus_wallets: [{ currency: "USD", balance: "0.4200000000000000", token_estimation: "0" }],
                total_costs: [{ currency: "USD", amount: "12.5197834160000000" }]
            }
        }
    };
}

const routes = {
    "/api/v0/users/get_user_summary": summaryPayload,
    "/api/v0/usage/by_api_key/cost": costPayload,
    "/api/v0/usage/by_api_key/amount": amountPayload
};

http.createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const handler = routes[path];
    if (!handler) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ detail: "Not Found" }));
        return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(handler()));
}).listen(port, "127.0.0.1", () => {
    console.log("mock platform API on http://127.0.0.1:" + port);
});
