// lib/redis.js
import { createClient } from 'redis'

const client = createClient({
  url: 'redis://localhost:6379'
})

client.on('error', (err) => console.log('Redis Client Error', err))

await client.connect()

// Cache API responses
export async function getCachedData(key, fetchFn, ttl = 3600) {
  const cached = await client.get(key)
  
  if (cached) {
    return JSON.parse(cached)
  }
  
  const fresh = await fetchFn()
  await client.setEx(key, ttl, JSON.stringify(fresh))
  
  return fresh
}