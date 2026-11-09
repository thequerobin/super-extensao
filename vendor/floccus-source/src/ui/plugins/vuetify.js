import Vue from 'vue'
import Vuetify from 'vuetify/lib'
import 'vuetify/dist/vuetify.min.css'

Vue.use(Vuetify)

const opts = {
  theme: {
    dark: true,
    themes:{dark:{primary:'#9ab8ff',secondary:'#6fd8c5',accent:'#b49aff'},light:{primary:'#245bd0',secondary:'#23746b',accent:'#7553bd'}},
  },
}

export default new Vuetify(opts)
