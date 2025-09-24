import { useCallback, useEffect } from 'react'
import { logEvent, LogEventPayload, detectBotClientSide } from '../utils/logEvent'
import { getOrCreateAnonymousId, getUserId, extractGroupIdFromEmail } from '../utils/userUtils'

const INITIAL_REFERRER_KEY = 'app_initial_referrer'
const UTM_PARAMS_KEY = 'app_utm_params'
const UTM_PARAM_NAMES = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
]

const getInitialReferrer = (): string | undefined => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return undefined

  try {
    let initialReferrer = sessionStorage.getItem(INITIAL_REFERRER_KEY)

    if (initialReferrer === null) {
      initialReferrer = document.referrer || 'direct'
      sessionStorage.setItem(INITIAL_REFERRER_KEY, initialReferrer)
    }

    return initialReferrer || undefined
  } catch (error) {
    return undefined
  }
}

const getUserAgent = (): string => {
  if (typeof window === 'undefined') return ''
  return window.navigator.userAgent
}

const getWebdriver = (): boolean => {
  return typeof window !== 'undefined' && !!window.navigator.webdriver
}

const isHeadless = (): boolean => {
  return /HeadlessChrome/.test(getUserAgent())
}

const getOS = (): string => {
  if (typeof window === 'undefined') return 'unknown'

  const userAgent = getUserAgent().toLowerCase()

  if (userAgent.indexOf('win') !== -1) return 'Windows'
  if (userAgent.indexOf('ipad') !== -1) return 'iPad'
  if (userAgent.indexOf('iphone') !== -1 || userAgent.indexOf('like mac') !== -1) return 'iOS'
  if (userAgent.indexOf('mac') !== -1) return 'MacOS'
  if (userAgent.indexOf('android') !== -1) return 'Android'
  if (userAgent.indexOf('linux') !== -1) return 'Linux'
  return 'unknown'
}

const getTimezone = (): string => {
  if (typeof window === 'undefined') return 'unknown'

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (error) {
    return 'unknown'
  }
}

export const useLogEvent = () => {
  useEffect(() => {
    getInitialReferrer()
    captureAndStoreUtmParams()
  }, [])

  return useCallback(
    ({
      eventName,
      attributes,
      eventType,
      groupId,
    }: Omit<LogEventPayload, 'userId' | 'anonymousId'>) => {
      const userId = getUserId()
      const anonymousId = getOrCreateAnonymousId()
      // Use provided groupId or extract it from userId if available
      const resolvedGroupId = groupId || extractGroupIdFromEmail(userId)

      // Detect bots on client side for additional coverage
      const clientBotDetection = detectBotClientSide()

      const utmParams = getStoredUtmParams()

      const enhancedAttributes = {
        ...attributes,
        custom_os: getOS(),
        custom_timezone: getTimezone(),
        custom_initial_referrer: getInitialReferrer(),
        custom_user_agent: getUserAgent(),
        custom_webdriver: getWebdriver(),
        custom_headless: isHeadless(),
        custom_source: 'web',
        // Enhanced bot detection attributes
        custom_is_bot_client: clientBotDetection.isBot,
        custom_bot_type_client: clientBotDetection.botType,
        custom_bot_detection_reason: clientBotDetection.reason,
        custom_has_javascript: true, // This runs in JS context
        ...utmParams,
      }

      const eventPayload: LogEventPayload = {
        eventName,
        attributes: enhancedAttributes,
        eventType,
        userId,
        anonymousId,
      }

      // Only add groupId if it exists
      if (resolvedGroupId) {
        eventPayload.groupId = resolvedGroupId
      }

      logEvent(eventPayload, {
        queryParams: utmParams,
      })
    },
    []
  )
}

const captureAndStoreUtmParams = () => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return

  try {
    const searchParams = new URLSearchParams(window.location.search)
    const utmParams: Record<string, string> = {}

    UTM_PARAM_NAMES.forEach((key) => {
      const value = searchParams.get(key)
      if (value) {
        utmParams[key] = value
      }
    })

    if (Object.keys(utmParams).length > 0) {
      sessionStorage.setItem(UTM_PARAMS_KEY, JSON.stringify(utmParams))
    }
  } catch (error) {
    // Ignore storage errors
  }
}

const getStoredUtmParams = (): Record<string, string> => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return {}

  try {
    const stored = sessionStorage.getItem(UTM_PARAMS_KEY)
    if (!stored) return {}

    const parsed = JSON.parse(stored) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}
