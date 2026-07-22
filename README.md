# IB Studio · CRM

CRM privado de prospección de negocios locales. Cada cuenta tiene su propio
pipeline, aislado en PostgreSQL mediante Supabase Auth y Row-Level Security.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase**: PostgreSQL, autenticación y Row-Level Security
- **Leaflet** para el mapa · **Recharts** para las gráficas
- Geocodificación con **Nominatim** (OpenStreetMap)

## Configurar Supabase

1. Crea un proyecto en Supabase o instala Supabase desde Vercel Marketplace.
2. Abre el SQL Editor de Supabase y ejecuta, en orden, los archivos de
   `supabase/migrations/`.
3. Copia `.env.example` a `.env.local` y completa la URL y la publishable key
   desde el panel **Connect** del proyecto.
4. En **Authentication → URL Configuration**, configura:
   - Site URL local: `http://localhost:3000`
   - Redirect URL local: `http://localhost:3000/auth/callback`
   - Añade también `https://tu-dominio.vercel.app/auth/callback` al desplegar.
5. Crea un widget **Managed** en Cloudflare Turnstile y añade tu hostname de
   producción y `localhost` si vas a usar el mismo proyecto Supabase en local.
   Copia su **site key** en `NEXT_PUBLIC_TURNSTILE_SITE_KEY` tanto en
   `.env.local` como en Vercel.
6. En Supabase, abre **Authentication → Bot and Abuse Protection**, activa
   CAPTCHA, selecciona Cloudflare Turnstile y pega allí la **secret key**. La
   secret key no debe añadirse a las variables públicas de Next.js o Vercel.

Turnstile usa el modo `interaction-only`: la comprobación sucede en segundo
plano y el reto solo se muestra cuando Cloudflare necesita interacción.

Para producción, configura un proveedor SMTP propio en Supabase para los emails
de confirmación y recuperación de contraseña.

## Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), crea una cuenta y confirma
el email. No se importa ni se crea ningún dato inicial.

## Funcionalidades

- Registro, login, recuperación de contraseña y gestión de cuenta.
- Datos aislados por usuario con políticas RLS en todas las tablas.
- Resumen con KPIs, pipeline, actividad semanal y próximos follow-ups.
- Tabla de leads con búsqueda, filtros y edición rápida, incluido un estado
  específico para la web del negocio.
- Mapa de negocios coloreado por estado.
- Etiquetas por cuenta y entrada rápida con `N` o `⌘K`.
