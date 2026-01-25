import { createApp } from 'vue'
import Overlay from './components/Overlay.vue'
import './assets/main.css'

const app = createApp(Overlay)
app.mount('#overlay-app')
