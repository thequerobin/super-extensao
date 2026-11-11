import catalog from './catalog.json';

// Native Vue 2 adapter. The rendered node is the control itself: no extra wrapper.
export function installUi(Vue) {
  for (const [key, spec] of Object.entries(catalog)) {
    const name = 'Ui' + key[0].toUpperCase() + key.slice(1);
    Vue.component(name, {
      functional: true,
      render(h, context) {
        const data = { ...context.data, attrs: { ...spec.attrs, ...context.data.attrs } };
        const tag = data.attrs.as || spec.tag;
        if (!(spec.tags || [spec.tag]).includes(tag)) throw new Error(`Invalid tag for ${name}: ${tag}`);
        delete data.attrs.as;
        if (tag !== 'button') delete data.attrs.type;
        data.class = [spec.class, data.class];
        // Vue has already converted v-model to value/input for these native components.
        if (data.attrs.value !== undefined && ['input', 'select', 'textarea'].includes(tag)) {
          data.domProps = { ...data.domProps, value: data.attrs.value };
          delete data.attrs.value;
        }
        if (context.data.model && ['input', 'select', 'textarea'].includes(tag)) {
          const model = context.data.model;
          const event = tag === 'select' ? 'change' : 'input';
          const listeners = { ...data.on };
          for (const key of Object.keys(listeners)) {
            const handlers = [].concat(listeners[key]).filter(handler => handler !== model.callback);
            if (handlers.length) listeners[key] = handlers;
            else delete listeners[key];
          }
          data.domProps = { ...data.domProps, value: model.value };
          data.on = { ...listeners, [event]: [].concat(listeners[event] || [], e => model.callback(e.target.value)) };
        }
        return h(tag, data, context.children);
      },
    });
  }
}
