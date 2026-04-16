import { describe, expect, it } from "vitest";
import { NODE_LTS_VERSION, PROJECT_NAME } from "./constants";

/**
 * shared 常量基础测试。
 */
describe("shared constants", () => {
  /**
   * 校验项目名常量存在。
   */
  it("should expose project name", () => {
    expect(PROJECT_NAME).toBe("Scribdown");
  });

  /**
   * 校验固定 Node LTS 版本。
   */
  it("should keep fixed node lts version", () => {
    expect(NODE_LTS_VERSION).toBe("24.15.0");
  });
});
