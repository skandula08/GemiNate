import { createContext } from "react";

/**
 * Context to manage the current time.
 * This context provides the current date and time as a Date object.
 *
 * @property currentTime - The current date and time.
 */
export const TimeContext = createContext<Date>(new Date());
