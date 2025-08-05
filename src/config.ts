export const envSchema = {
  type: "object",
  required: ["PORT"],
  properties: {
    PORT: {
      type: "integer",
      default: 3000,
    },
    LOG_LEVEL: {
      type: "string",
      default: "info",
    },
  },
} as const;
