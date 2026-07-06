import "server-only"
import { cookies } from "next/headers"

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue
  }
  return value === "true" || value === "1"
}

const storefrontCookieSecure = parseBoolean(
  process.env.STOREFRONT_COOKIE_SECURE,
  process.env.NODE_ENV === "production"
)
const storefrontCookieSameSite =
  (process.env.STOREFRONT_COOKIE_SAME_SITE as "strict" | "lax" | "none") ||
  (storefrontCookieSecure ? "none" : "lax")

export const getAuthHeaders = async (): Promise<
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  { authorization: string } | {}
> => {
  const token = (await cookies()).get("_medusa_jwt")?.value

  if (token) {
    return { authorization: `Bearer ${token}` }
  }

  return {}
}

export const setAuthToken = async (token: string) => {
  return (await cookies()).set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: storefrontCookieSameSite,
    secure: storefrontCookieSecure,
  })
}

export const removeAuthToken = async () => {
  return (await cookies()).set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  return (await cookies()).get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  return (await cookies()).set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: storefrontCookieSameSite,
    secure: storefrontCookieSecure,
  })
}

export const removeCartId = async () => {
  return (await cookies()).set("_medusa_cart_id", "", { maxAge: -1 })
}
