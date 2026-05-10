import { redirect } from 'next/navigation';

// Middleware redirects unauthenticated `/` straight to `/login`.
// If we reach this component, the cookie is present — go to the dashboard.
export default function HomePage() {
  redirect('/dashboard');
}
