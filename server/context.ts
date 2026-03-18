import {db} from "./db"

export const createContext = async () => {
  return {
    db
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>