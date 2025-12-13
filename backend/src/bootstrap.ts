import dotenv from "dotenv";

dotenv.config({
  path:
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test" ||
    process.env.npm_lifecycle_event === "pretest" ||
    process.env.npm_lifecycle_event === "posttest"
      ? ".env.test"
      : ".env"
});
