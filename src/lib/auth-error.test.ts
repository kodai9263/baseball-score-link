import { describe, expect, it } from "vitest";
import { describeAuthFailure, getAuthFailureLog } from "./auth-error";

describe("describeAuthFailure", () => {
  it("送信制限を利用者向けに説明する", () => {
    expect(
      describeAuthFailure({
        code: "over_email_send_rate_limit",
        message: "email rate limit exceeded",
        status: 429,
      }),
    ).toContain("60秒以上待って");
  });

  it("SMTP送信失敗を設定エラーとして説明する", () => {
    expect(
      describeAuthFailure({
        code: "unexpected_failure",
        message: "Error sending magic link email",
        status: 500,
      }),
    ).toBe(
      "メール配信設定でエラーが発生しました。管理者がSMTP設定を確認してください。（unexpected_failure）",
    );
  });

  it("サーバーの生メッセージを画面に出さない", () => {
    const message = describeAuthFailure({
      message: "internal recipient@example.com detail",
      status: 503,
    });

    expect(message).toContain("HTTP 503");
    expect(message).not.toContain("recipient@example.com");
  });
});

describe("getAuthFailureLog", () => {
  it("診断に必要な項目だけを返す", () => {
    expect(
      getAuthFailureLog({
        code: "unexpected_failure",
        message: "SMTP rejected",
        status: 500,
        email: "recipient@example.com",
      }),
    ).toEqual({
      code: "unexpected_failure",
      message: "SMTP rejected",
      status: 500,
    });
  });
});
