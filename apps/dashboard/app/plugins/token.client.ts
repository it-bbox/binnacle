import { saveToken, useAuthorised } from '~/composables/daemon';

/**
 * `binn dashboard` opens `/#token=<token>`. The token moves into the browser's storage and
 * the fragment leaves the address by replacing the history entry, once the app is mounted:
 * the router's initial navigation, made before that, would put the fragment back (ADR-0031).
 */
export default defineNuxtPlugin((nuxtApp) => {
  const token = /^#token=(.+)$/.exec(window.location.hash)?.[1];
  if (token === undefined) return;
  saveToken(token);
  useAuthorised().value = true;
  const router = useRouter();
  nuxtApp.hook('app:mounted', () => {
    void router.replace(router.currentRoute.value.fullPath.split('#')[0] ?? '/');
  });
});
