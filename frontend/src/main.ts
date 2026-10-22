import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

import 'primeicons/primeicons.css';
import './styles/main.css';
import './styles/app-theme.css';
import './styles/safety-dashboard.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  unstyled: true,
  ripple: false,
});
app.use(ToastService);

app.mount('#app');
