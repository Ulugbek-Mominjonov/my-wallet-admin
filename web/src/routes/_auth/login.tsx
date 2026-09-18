import { createFileRoute } from '@tanstack/react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Wallet</CardTitle>
        <CardDescription>Boshqaruv paneliga kirish</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Kirish usullari (Google, email kod) tez orada qo&apos;shiladi.
      </CardContent>
    </Card>
  )
}
