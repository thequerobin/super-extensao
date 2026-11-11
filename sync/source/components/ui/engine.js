/* SPDX-License-Identifier: MPL-2.0 */
// Keep Vuetify's models, validation, slots, injection and dialog lifecycles intact.
// These subclasses are the only boundary between sync screens and the UI library.
import {
  VTextField, VSelect, VSwitch, VCheckbox, VRadio, VRadioGroup, VSlider, VForm,
  VDialog, VTreeview, VStepper, VStepperItems, VStepperContent,
  VExpansionPanels, VExpansionPanel, VExpansionPanelHeader, VExpansionPanelContent,
  VCard, VCardTitle, VCardText, VCardActions, VBtn, VAlert, VTooltip,
  VProgressCircular, VProgressLinear, VContainer, VRow, VCol, VIcon,
} from 'vuetify/lib';
import catalog from '../../../../ui/catalog.json';

const names = {
  TextField: VTextField, Select: VSelect, Switch: VSwitch, Checkbox: VCheckbox,
  Radio: VRadio, RadioGroup: VRadioGroup, Slider: VSlider, Form: VForm,
  Dialog: VDialog, Tree: VTreeview, Stepper: VStepper, StepperItems: VStepperItems,
  StepperContent: VStepperContent, Panels: VExpansionPanels, Panel: VExpansionPanel,
  PanelHeader: VExpansionPanelHeader, PanelContent: VExpansionPanelContent,
  Card: VCard, CardTitle: VCardTitle, CardBody: VCardText, CardActions: VCardActions,
  Button: VBtn, Alert: VAlert, Tooltip: VTooltip, Spinner: VProgressCircular,
  Progress: VProgressLinear, Container: VContainer, Row: VRow, Col: VCol, Icon: VIcon,
};

export function installEngineUi(Vue) {
  for (const [name, Original] of Object.entries(names)) {
    // Extend rather than wrap: parent-child protocols (radio, panels, steps) are preserved.
    const sharedClass = {
      Button: catalog.button.class, Card: catalog.card.class + ' ui-card-framed',
      CardTitle: catalog.title.class, CardBody: 'ui-card-body', CardActions: catalog.actions.class,
      TextField: 'ui-engine-field', Select: 'ui-engine-field', Switch: 'ui-engine-switch',
      Checkbox: 'ui-engine-check', Dialog: 'ui-engine-dialog',
    }[name];
    Vue.component('Sync' + name, Original.extend(sharedClass ? {
      render(h, context) {
        const node = Original.options.functional
          ? Original.options.render(h, context)
          : Original.options.render.call(this, h);
        node.data = { ...node.data, class: [node.data && node.data.class, sharedClass] };
        return node;
      },
    } : {}));
  }
}
