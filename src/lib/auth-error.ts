type AuthFailure = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function readAuthFailure(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: "", message: "", status: undefined };
  }

  const failure = error as AuthFailure;
  return {
    code: typeof failure.code === "string" ? failure.code : "",
    message: typeof failure.message === "string" ? failure.message : "",
    status: typeof failure.status === "number" ? failure.status : undefined,
  };
}

export function describeAuthFailure(error: unknown) {
  const { code, message, status } = readAuthFailure(error);
  const detail = `${code} ${message}`.toLowerCase();
  const reference = code || (status ? `HTTP ${status}` : "詳細不明");

  if (
    status === 429 ||
    detail.includes("rate limit") ||
    detail.includes("rate_limit")
  ) {
    return `送信回数の上限に達しました。60秒以上待ってから、もう一度お試しください。（${reference}）`;
  }

  if (detail.includes("invalid") && detail.includes("email")) {
    return `メールアドレスの形式を確認してください。（${reference}）`;
  }

  if (
    detail.includes("smtp") ||
    detail.includes("error sending") ||
    detail.includes("email sending") ||
    code === "unexpected_failure"
  ) {
    return `メール配信設定でエラーが発生しました。管理者がSMTP設定を確認してください。（${reference}）`;
  }

  return `ログインメールを送れませんでした。少し待ってからお試しください。（${reference}）`;
}

export function getAuthFailureLog(error: unknown) {
  return readAuthFailure(error);
}
