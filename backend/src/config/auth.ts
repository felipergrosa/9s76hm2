export default {
  secret: process.env.JWT_SECRET || "mysecret",
  expiresIn: "3650d",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "myanothersecret",
  refreshExpiresIn: "3650d"
};
