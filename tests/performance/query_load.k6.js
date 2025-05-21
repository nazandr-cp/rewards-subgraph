import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    stages: [
        { duration: "30s", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "10s", target: 0 },
    ],
};

const queries = [
    { name: "query1", query: "{ entities(first: 5) { id } }" },
    { name: "query2", query: "{ _meta { block { number } } }" },
];

export default function () {
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    const url = "http://localhost:8000/subgraphs/name/rewards-subgraph";
    const payload = JSON.stringify({ query: randomQuery.query });
    const params = {
        headers: {
            "Content-Type": "application/json",
        },
    };

    const res = http.post(url, payload, params);
    check(res, {
        [`status is 200 for ${randomQuery.name}`]: (r) => r.status === 200,
        [`graphql data present for ${randomQuery.name}`]: (r) => {
            try {
                const body = JSON.parse(r.body);
                return body && body.data && !body.errors;
            } catch (_e) {
                return false;
            }
        },
    });
    sleep(1);
}