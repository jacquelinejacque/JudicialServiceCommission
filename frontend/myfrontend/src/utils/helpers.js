import { jwtDecode } from 'jwt-decode'

export function isTokenExpired() {
  const token = localStorage.getItem('accessToken')
  if (!token) return true

  // console.log(token)
  try {
    const decodedToken = jwtDecode(token)
    const currentTime = Date.now() / 1000
    return decodedToken.exp < currentTime
  } catch (err) {
    return true
  }


}
export function formatPhoneNumber(phoneNumber) {
  const cleaned = ('' + phoneNumber).replace(/\D/g, '')
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    return match[1] + '-' + match[2] + '-' + match[3]
  }
  return phoneNumber
}