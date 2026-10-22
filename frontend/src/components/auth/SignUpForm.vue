<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { getErrorMessage } from '../../api/client';

const auth = useAuthStore();
const router = useRouter();

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const agreeTerms = ref(false);
const loading = ref(false);
const error = ref('');
const emailInvalid = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordValid(value: string): boolean {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

async function submit() {
  error.value = '';
  emailInvalid.value = false;

  if (!firstName.value.trim() || !lastName.value.trim()) {
    error.value = 'First name and last name are required.';
    return;
  }

  if (!email.value.trim() || !password.value || !confirmPassword.value) {
    error.value = 'All fields are required.';
    emailInvalid.value = !email.value.trim();
    return;
  }

  if (!validateEmail(email.value.trim())) {
    error.value = 'Please enter a valid email address.';
    emailInvalid.value = true;
    return;
  }

  if (!passwordValid(password.value)) {
    error.value = 'Password must be at least 8 characters and contain at least one letter and one number.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.';
    return;
  }

  if (!agreeTerms.value) {
    error.value = 'You must agree to the Terms & Conditions and Privacy Policy.';
    return;
  }

  loading.value = true;
  try {
    await auth.register(
      firstName.value.trim(),
      lastName.value.trim(),
      email.value.trim(),
      password.value,
      confirmPassword.value,
    );
    await router.push('/dashboard');
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <section class="auth-card"><h2>Create your account</h2><p class="auth-description">Set up access to the pedestrian safety monitoring workspace.</p>
    <form class="auth-form" @submit.prevent="submit" novalidate>
      <div class="auth-name-fields"><div><label for="first-name">First name</label><input id="first-name" v-model="firstName" autocomplete="given-name" :disabled="loading" required /></div><div><label for="last-name">Last name</label><input id="last-name" v-model="lastName" autocomplete="family-name" :disabled="loading" required /></div></div>
      <div><label for="email">Email address</label><input id="email" v-model="email" type="email" autocomplete="username" placeholder="you@example.com" :aria-invalid="emailInvalid" :disabled="loading" required /></div>
      <div><label for="password">Password</label><div class="auth-password"><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" :disabled="loading" required /><button type="button" :aria-pressed="showPassword" aria-label="Toggle password visibility" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button></div></div>
      <div><label for="confirm-password">Confirm password</label><div class="auth-password"><input id="confirm-password" v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" :disabled="loading" required /><button type="button" :aria-pressed="showConfirmPassword" aria-label="Toggle confirm password visibility" @click="showConfirmPassword = !showConfirmPassword">{{ showConfirmPassword ? 'Hide' : 'Show' }}</button></div></div>
      <div class="auth-check"><input id="agree-terms" v-model="agreeTerms" type="checkbox" :disabled="loading" /><label for="agree-terms">I agree to the Terms &amp; Conditions and Privacy Policy.</label></div>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <button type="submit" class="auth-submit" :disabled="loading" :aria-busy="loading">{{ loading ? 'Creating account…' : 'Create Account' }}</button>
    </form>
    <p class="auth-footer">Already have an account? <RouterLink to="/login">Sign In</RouterLink></p>
  </section>
</template>
