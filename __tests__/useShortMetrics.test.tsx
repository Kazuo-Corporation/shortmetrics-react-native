/**
 * useShortMetrics Hook Tests
 *
 * Note: Testing React hooks requires a React rendering environment.
 * These tests verify the module structure and that it can be imported.
 * For full integration testing of the hook, use it in the example app.
 */

import { useShortMetrics } from "../src/useShortMetrics";
import { ShortMetrics } from "../src/ShortMetrics";

jest.mock("../src/ShortMetrics");
jest.mock("../src/storage");
jest.mock("../src/utils/deviceInfo");

describe("useShortMetrics", () => {
  it("should be a function", () => {
    expect(typeof useShortMetrics).toBe("function");
  });

  it("should be exported from the module", () => {
    expect(useShortMetrics).toBeDefined();
  });

  it("should have a name", () => {
    expect(useShortMetrics.name).toBe("useShortMetrics");
  });
});

describe("useShortMetrics module dependencies", () => {
  it("should import ShortMetrics class", () => {
    expect(ShortMetrics).toBeDefined();
  });
});
