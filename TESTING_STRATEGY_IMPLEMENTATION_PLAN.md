# Plan to set up Unit Tests with `matchstick-as` (Phase 2)

**Goal:** Establish the testing foundation as outlined in "Phase 2: Unit tests with `matchstick-as`" of the project's test strategy document. This includes creating the directory structure, the example test files as specified, and the `coverage` script in `package.json`.

**Detailed Steps:**

1.  **Create Directory Structure:**

    - Create the top-level `tests/` directory.
    - Inside `tests/`, create the `unit/` directory.
    - Inside `tests/unit/`, create the `utils/` directory.
      This will result in:

    ```
    tests/
    └── unit/
        └── utils/
    ```

2.  **Create Example Test Files (as per the strategy document's scaffold):**

    - **`tests/unit/rewardHandlers.test.ts`**: This file will contain the "Example stub" provided in the strategy document.
      - To make the stub runnable, minimal mock definitions for the `RewardPaid` event and the `handleRewardPaid` handler will be included directly within this test file. These can later be replaced with imports from actual generated types and mapping files.
      - The assertion `assert.fieldEquals("Reward", ..., "amount", "1000")` will also be included as per the stub. This assumes a "Reward" entity is defined in `schema.graphql` and that the handler logic would save such an entity.
    - **`tests/unit/ownership.test.ts`**: A placeholder file with a basic test structure.
    - **`tests/unit/utils/toDecimal.test.ts`**: A placeholder file for utility function tests.

3.  **Update `package.json`:**
    - Add a `coverage` script to the `scripts` section:
      `"coverage": "graph test --coverage"`
      This command uses `matchstick-as` to run tests and generate coverage information.

**Mermaid Diagram of the Plan (Phase 2):**

```mermaid
graph TD
    A[Start: Setup Unit Tests Phase 2] --> B(Step 1: Create Directory Structure);
    B --> B1[Create tests/];
    B1 --> B2[Create tests/unit/];
    B2 --> B3[Create tests/unit/utils/];

    A --> C(Step 2: Create Example Test Files);
    C --> C1[Create tests/unit/rewardHandlers.test.ts <br>(with user's stub & necessary mocks)];
    C --> C2[Create tests/unit/ownership.test.ts <br>(placeholder)];
    C --> C3[Create tests/unit/utils/toDecimal.test.ts <br>(placeholder)];

    A --> D(Step 3: Update package.json);
    D --> D1[Add "coverage" script];

    B3 --> E{Foundation Ready};
    C1 --> E;
    C2 --> E;
    C3 --> E;
    D1 --> E;
    E --> F[End: Phase 2 Unit Test Setup Complete];
```

**Important Considerations for `tests/unit/rewardHandlers.test.ts`:**

- The `RewardPaid` event and `handleRewardPaid` handler in the test stub are treated as illustrative. The test file will contain self-contained mocks for these to ensure it's runnable.
- This test file will need to be adapted to the actual subgraph logic by:
  - Importing real event types from the `../generated/` directory.
  - Importing actual handler functions from `../../src/` (adjusting paths as needed).
  - Ensuring the entity types and fields in assertions (e.g., `"Reward"`, `"amount"`) match `schema.graphql` and the behavior of the handlers.

---

# Plan for Phase 3: Integration tests: local-chain + graph-node

**Goal:** Set up an integration testing environment as described in "Phase 3" of the test strategy. This involves using Hardhat for a local chain, deploying mock contracts, emitting events, running a local `graph-node` instance, and using Jest for assertions against the subgraph.

**Prerequisites (to be installed if not present):**

- Hardhat (`hardhat`)
- Jest (`jest`, `ts-jest`, `@types/jest`)

**Detailed Steps:**

1.  **Install Dependencies:**

    - Add Hardhat and its necessary plugins (e.g., `hardhat-ethers`, `@nomicfoundation/hardhat-toolbox` or similar) to `devDependencies` in `package.json`.
    - Add Jest, `ts-jest` (for TypeScript support), and `@types/jest` to `devDependencies`.
    - Run `npm install` or `yarn install`.

2.  **Set up Hardhat Environment:**

    - Initialize Hardhat in the project if not already done (`npx hardhat`). This will create `hardhat.config.js` (or `.ts`).
    - Create a `contracts/mocks/` directory for minimal mock versions of your rewards contracts.
    - Create a `scripts/` directory within the Hardhat setup (e.g., `hardhat_scripts/`) for deployment and event emission scripts.

3.  **Develop Mock Contracts:**

    - Create basic Solidity contracts in `contracts/mocks/` that emit the necessary events (e.g., `RewardPaid`, `UserRegistered`, etc., matching your actual contract events that the subgraph indexes).

4.  **Develop Hardhat Scripts:**

    - **Deployment Script (`hardhat_scripts/deploy-mocks.ts`):** A script to deploy the mock contracts to the local Hardhat network.
    - **Event Emission Script (`hardhat_scripts/emit-events.ts`):** A script that interacts with the deployed mock contracts to emit a deterministic sequence of events covering happy paths and edge cases (e.g., 0 amount, duplicate user).

5.  **Set up Jest for Integration Tests:**

    - Create a `jest.config.js` (or `.ts`) file, configuring it for TypeScript using `ts-jest`.
    - Create a `tests/integration/` directory.
    - Example test file: `tests/integration/rewards.integration.test.ts`.

6.  **Write Integration Test Logic (`tests/integration/rewards.integration.test.ts`):**

    - This test will:
      - Programmatically start the Hardhat node (or ensure it's running).
      - Run the `deploy-mocks.ts` and `emit-events.ts` Hardhat scripts.
      - Ensure `docker-compose up` is run for `graph-node`, `ipfs`, `postgres`.
      - Execute `graph create` and `graph deploy` to the local node.
      - Poll the subgraph's GraphQL endpoint until `latestBlock` matches `hardhat.blockNumber`.
      - Perform GraphQL queries for assertions.
      - Use Jest snapshots for complex queries (e.g., `topEarners`, `dailySnapshots`).

7.  **Update `package.json` Scripts:**
    - Add a script for running integration tests, e.g., `"test:integration": "jest --config jest.config.js tests/integration"`.
    - Potentially add helper scripts for Hardhat tasks if needed.

**Mermaid Diagram for Phase 3:**

```mermaid
graph TD
    P3_Start[Start: Setup Integration Tests - Phase 3] --> P3_A(Step 1: Install Dependencies);
    P3_A --> P3_A1[Add Hardhat & plugins to package.json];
    P3_A --> P3_A2[Add Jest & ts-jest to package.json];
    P3_A --> P3_A3[Run npm/yarn install];

    P3_Start --> P3_B(Step 2: Set up Hardhat Environment);
    P3_B --> P3_B1[Initialize Hardhat (hardhat.config.js)];
    P3_B --> P3_B2[Create contracts/mocks/ directory];
    P3_B --> P3_B3[Create hardhat_scripts/ directory];

    P3_Start --> P3_C(Step 3: Develop Mock Contracts);
    P3_C --> P3_C1[Create mock Solidity contracts in contracts/mocks/];

    P3_Start --> P3_D(Step 4: Develop Hardhat Scripts);
    P3_D --> P3_D1[Create hardhat_scripts/deploy-mocks.ts];
    P3_D --> P3_D2[Create hardhat_scripts/emit-events.ts];

    P3_Start --> P3_E(Step 5: Set up Jest);
    P3_E --> P3_E1[Create jest.config.js];
    P3_E --> P3_E2[Create tests/integration/ directory];

    P3_Start --> P3_F(Step 6: Write Integration Test Logic);
    P3_F --> P3_F1[Create tests/integration/rewards.integration.test.ts];
    P3_F1 --> P3_F2[Test logic: Start Hardhat, run scripts, manage Docker, deploy subgraph, poll & assert];

    P3_Start --> P3_G(Step 7: Update package.json Scripts);
    P3_G --> P3_G1[Add "test:integration" script];

    P3_A3 --> P3_End{Integration Test Setup Ready};
    P3_B3 --> P3_End;
    P3_C1 --> P3_End;
    P3_D2 --> P3_End;
    P3_E2 --> P3_End;
    P3_F2 --> P3_End;
    P3_G1 --> P3_End;
    P3_End --> P3_Final[End: Phase 3 Integration Test Setup Complete];
```

---

# Plan for Phase 5: Performance & load tests

**Goal:** Establish capabilities for performance and load testing as outlined in "Phase 5" of the test strategy. This includes setting up for cold-sync benchmarks using `hyperfine` and query load tests using `k6`.

**Prerequisites (Tools to be installed, typically globally):**

- **`k6`**: For load testing GraphQL queries. (Installation: [k6 Documentation](https://k6.io/docs/getting-started/installation/))
- **`hyperfine`**: For command-line benchmarking, specifically for subgraph sync times. (Installation: [Hyperfine GitHub](https://github.com/sharkdp/hyperfine#installation))

**Detailed Steps:**

1.  **Tool Installation Guidance:**

    - Ensure `k6` and `hyperfine` are installed on the system where tests will be run. Refer to their official documentation for installation instructions.

2.  **Cold-Sync Benchmark Setup:**

    - **Script/Command:** Define a script or document the command for running the cold-sync benchmark. The strategy suggests:
      `hyperfine 'graph-node --config docker-compose.yml'`
      _Consider adding a warmup run: `hyperfine --warmup 1 'graph-node --config docker-compose.yml'`_
    - **Metrics Storage (External):** Note that storing duration in Prometheus and alerting is an external setup (e.g., CI/CD integration with a Prometheus instance) and is outside the direct scope of this initial setup plan.

3.  **Query Load Test Setup (k6):**

    - Create a dedicated directory for performance test scripts: `tests/performance/`.
    - Create an example `k6` script file: `tests/performance/query_load.k6.js`.
    - **Script Content (`query_load.k6.js`):**

      - Import `http` from `k6/http`.
      - Define `options` for stages to achieve desired QPS (e.g., ramp up to 100 QPS, sustain, ramp down).
      - Include a default function that makes `http.post` requests to the subgraph's GraphQL endpoint (`http://localhost:8000/subgraphs/name/rewards` or the relevant endpoint).
      - Include placeholders or examples for the "20 high-volume queries" mentioned in the strategy. These queries will need to be defined based on production data/expectations.

      ```javascript
      // tests/performance/query_load.k6.js
      import http from "k6/http";
      import { check, sleep } from "k6";

      export const options = {
        stages: [
          { duration: "30s", target: 100 }, // Ramp up to 100 users/QPS
          { duration: "1m", target: 100 }, // Stay at 100 users/QPS
          { duration: "10s", target: 0 }, // Ramp down
        ],
      };

      // Placeholder for your 20 high-volume queries
      const queries = [
        { name: "query1", query: "{ /* Your GraphQL Query 1 */ }" },
        { name: "query2", query: "{ /* Your GraphQL Query 2 */ }" },
        // ... add up to 20 queries
      ];

      export default function () {
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        const url = "http://localhost:8000/subgraphs/name/rewards"; // Adjust if your subgraph name/port is different
        const payload = JSON.stringify({ query: randomQuery.query });
        const params = {
          headers: {
            "Content-Type": "application/json",
          },
        };

        const res = http.post(url, payload, params);
        check(res, {
          [`status is 200 for ${randomQuery.name}`]: (r) => r.status === 200,
          [`no errors for ${randomQuery.name}`]: (r) =>
            !JSON.parse(r.body).errors,
        });
        sleep(1); // Adjust sleep time as needed
      }
      ```

4.  **Profiling Guidance (graphman):**

    - Document that if P95 query latency targets are missed during load tests, `graphman profile` (available via `graph-cli`) should be used to identify performance bottlenecks in handlers or schema design.
    - Example command: `graphman profile --gql-url http://localhost:8000/subgraphs/name/rewards --queries path/to/slow-queries.gql`

5.  **Update `package.json` Scripts:**
    - Add scripts to easily run these performance tests:
      - `"test:perf:sync": "hyperfine --warmup 1 'graph-node --config docker-compose.yml'"`
      - `"test:perf:query": "k6 run tests/performance/query_load.k6.js"`
      - `"test:perf:profile": "graphman profile --gql-url http://localhost:8000/subgraphs/name/rewards --queries tests/performance/example_profile_queries.gql"` (assuming an example query file for profiling)

**Mermaid Diagram for Phase 5:**

```mermaid
graph TD
    P5_Start[Start: Setup Performance & Load Tests - Phase 5] --> P5_A(Step 1: Tool Installation Guidance);
    P5_A --> P5_A1[Ensure k6 is installed];
    P5_A --> P5_A2[Ensure hyperfine is installed];

    P5_Start --> P5_B(Step 2: Cold-Sync Benchmark Setup);
    P5_B --> P5_B1[Define/document hyperfine command];
    P5_B --> P5_B2[Note on external Prometheus setup];

    P5_Start --> P5_C(Step 3: Query Load Test Setup - k6);
    P5_C --> P5_C1[Create tests/performance/ directory];
    P5_C --> P5_C2[Create tests/performance/query_load.k6.js with example structure];

    P5_Start --> P5_D(Step 4: Profiling Guidance - graphman);
    P5_D --> P5_D1[Document use of graphman profile];

    P5_Start --> P5_E(Step 5: Update package.json Scripts);
    P5_E --> P5_E1[Add "test:perf:sync" script];
    P5_E --> P5_E2[Add "test:perf:query" script];
    P5_E --> P5_E3[Add "test:perf:profile" script];

    P5_A2 --> P5_End{Performance Test Setup Ready};
    P5_B1 --> P5_End;
    P5_C2 --> P5_End;
    P5_D1 --> P5_End;
    P5_E3 --> P5_End;
    P5_End --> P5_Final[End: Phase 5 Performance & Load Test Setup Complete];
```
