<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { getErrorMessage } from '../../api/client';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const emailInvalid = ref(false);
const showPassword = ref(false);

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function submit() {
  error.value = '';
  emailInvalid.value = false;

  if (!email.value.trim() || !password.value) {
    error.value = 'Email and password are required.';
    emailInvalid.value = !email.value.trim();
    return;
  }

  if (!validateEmail(email.value.trim())) {
    error.value = 'Please enter a valid email address.';
    emailInvalid.value = true;
    return;
  }

  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    await router.push(redirect);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <section class="auth-card"><h2>Welcome back</h2><p class="auth-description">Sign in to your pedestrian safety monitoring workspace.</p>
    <form class="auth-form" @submit.prevent="submit" novalidate>
      <div><label for="email">Email address</label><input id="email" v-model="email" type="email" autocomplete="username" placeholder="you@example.com" :aria-invalid="emailInvalid" :disabled="loading" required /></div>
      <div><label for="password">Password</label><div class="auth-password"><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" :disabled="loading" required /><button type="button" :aria-pressed="showPassword" aria-label="Toggle password visibility" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button></div></div>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <button type="submit" class="auth-submit" :disabled="loading" :aria-busy="loading">{{ loading ? 'Signing in…' : 'Sign In' }}</button>
    </form>
    <p class="auth-footer">Access is restricted to the system administrator. Repeated failed sign-ins are blocked for 15 minutes.</p>
  </section>
</template>
