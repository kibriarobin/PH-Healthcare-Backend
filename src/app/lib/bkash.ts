import config from "../config";
import { redisClient } from "./redis";

export const getBKashIdToken = async () => {
  try {
    const idToken = "bkash:idToken";
    const refreshToken = "bkash:refreshToken";

    let bkashIdToken = await redisClient.get(idToken);
    const bkashIdTokenTTL = await redisClient.ttl(idToken);

    const bkashRefreshToken = await redisClient.get(refreshToken);
    const bkashRefreshTokenTTL = await redisClient.ttl(refreshToken);

    // console.log(
    //   bkashIdToken,
    //   bkashIdTokenTTL,
    //   bkashRefreshToken,
    //   bkashRefreshTokenTTL,
    // );

    if (
      (bkashIdTokenTTL <= 600 || !bkashIdToken) &&
      bkashRefreshToken &&
      bkashRefreshTokenTTL > 600
    ) {
      const refreshTokenResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },
          body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        },
      );

      const refreshTokenResult = await refreshTokenResponse.json();

      bkashIdToken = refreshTokenResult.id_token as string;

      await redisClient.set(idToken, bkashIdToken, {
        expiration: {
          type: "EX",
          value: 60 * 60, // 1 hour
        },
      });

      return bkashIdToken;
    }

    if (bkashIdTokenTTL > 600) {
      return bkashIdToken;
    }

    const response = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },
        body: JSON.stringify({
          app_key: config.bkash_app_key,
          app_secret: config.bkash_app_secret,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Bkash access token grant failed");
    }

    const result = await response.json();

    // bkash id token set id redis
    await redisClient.set(idToken, result.id_token, {
      expiration: {
        type: "EX",
        value: 60 * 60, // 1 hour
      },
    });

    // bkash refresh token set redis
    await redisClient.set(refreshToken, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 60 * 60 * 24 * 28, // 28 days
      },
    });

    bkashIdToken = result.id_token;

    return bkashIdToken;
  } catch (error) {
    return error;
  }
};
