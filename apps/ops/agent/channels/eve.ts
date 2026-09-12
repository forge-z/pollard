import { eveChannel } from "eve/channels/eve";
import { httpBasic, localDev, placeholderAuth } from "eve/channels/auth";

const username = process.env.ROUTE_AUTH_BASIC_USER?.trim();
const password = process.env.ROUTE_AUTH_BASIC_PASSWORD;
const configuredAuth =
  username && password ? httpBasic({ username, password }) : placeholderAuth();

export default eveChannel({
  auth: process.env.NODE_ENV === "production" ? [configuredAuth] : [localDev(), configuredAuth],
  uploadPolicy: "disabled",
});
