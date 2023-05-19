/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CheckboxInterface,
    IntegerInterface,
    NumberInterface,
    SelectInterface,
    NodeInterface,
    TextInterface,
    defineNode,
    setType,
    NodeInterfaceType,
} from 'baklavajs';

import InputInterface from '../interfaces/InputInterface';
import ListInterface from '../interfaces/ListInterface';
import SliderInterface from '../interfaces/SliderInterface';

function parseProperties(properties) {
    const tempInputs = {};
    properties.forEach((p) => {
        const propName = p.name;
        const propType = p.type;
        let propDef = p.default;

        switch (propType) {
            case 'constant':
                tempInputs[propName] = () => {
                    const intf = new TextInterface(propName, propDef).setPort(false);
                    intf.componentName = 'TextInterface';
                    return intf;
                };
                break;
            case 'text':
                tempInputs[propName] = () => {
                    const intf = new InputInterface(propName, propDef).setPort(false);
                    intf.componentName = 'InputInterface';
                    return intf;
                };
                break;
            case 'number':
                tempInputs[propName] = () => {
                    const intf = new NumberInterface(propName, propDef).setPort(false);
                    intf.componentName = 'NumberInterface';
                    return intf;
                };
                break;
            case 'integer':
                tempInputs[propName] = () => {
                    const intf = new IntegerInterface(propName, propDef).setPort(false);
                    intf.componentName = 'IntegerInterface';
                    return intf;
                };
                break;
            case 'select': {
                const it = p.values.map((element) => element.toString());
                tempInputs[propName] = () => {
                    const intf = new SelectInterface(propName, propDef, it).setPort(false);
                    intf.componentName = 'SelectInterface';
                    return intf;
                };
                break;
            }
            case 'checkbox':
                tempInputs[propName] = () => {
                    const intf = new CheckboxInterface(propName, propDef).setPort(false);
                    intf.componentName = 'CheckboxInterface';
                    return intf;
                };
                break;
            case 'slider':
                if (propDef === undefined) {
                    propDef = p.min;
                }
                tempInputs[propName] = () => {
                    const intf = new SliderInterface(propName, propDef, p.min, p.max).setPort(
                        false,
                    );
                    intf.componentName = 'SliderInterface';
                    return intf;
                };
                break;
            case 'list':
                tempInputs[propName] = () => {
                    const intf = new ListInterface(propName, propDef, p.dtype).setPort(false);
                    intf.componentName = 'ListInterface';
                    return intf;
                };
                break;
            default:
                /* eslint-disable no-console */
                console.error(propType, '- input type is not recognized.');
        }
    });
    return tempInputs;
}

function parseOutputs(outputs, interfaceTypes) {
    const tempOutputs = {};

    outputs.forEach((o) => {
        tempOutputs[o.name] = () => {
            const intf = new NodeInterface(o.name).use(setType, interfaceTypes[o.type]);
            intf.componentName = 'NodeInterface';
            return intf;
        };
    });

    return tempOutputs;
}

function parseInputs(inputs, interfaceTypes) {
    const tempInputs = {};

    inputs.forEach((i) => {
        tempInputs[i.name] = () => {
            const intf = new NodeInterface(i.name).use(setType, interfaceTypes[i.type]);
            intf.componentName = 'NodeInterface';
            return intf;
        };
    });

    return tempInputs;
}

/**
 * Class factory that creates a class for a custom Node that is described by the arguments.
 * It can be later registered so that the user can use it and save the editor.
 * `inputs`, `properties` and `outputs` formats are described in the documentation.
 *
 * @param {string} name Name of the block that is stored when saving
 * @param {string} displayName Name of the block displayed to the user
 * @param {*} inputs List of inputs of the block.
 * @param {*} properties List of properties of the block
 * @param {*} outputs List of outputs of the block
 * @param {*} interfaceTypes ReadInterfaceTypes of the specification
 * @param {boolean} twoColumn type of layout of the nodes
 * @returns Node based class
 */
export function NodeFactory(
    name,
    displayName,
    inputs,
    properties,
    outputs,
    interfaceTypes,
    twoColumn,
) {
    const node = defineNode({
        type: name,

        title: displayName,

        outputs: parseOutputs(outputs, interfaceTypes),
        inputs: { ...parseProperties(properties), ...parseInputs(inputs, interfaceTypes) },

        /* eslint-disable no-param-reassign */
        onCreate() {
            this.parentSave = this.save;
            this.parentLoad = this.load;

            this.save = () => {
                const savedState = this.parentSave();

                const newProperties = {};
                const newInputs = {};

                Object.entries(savedState.inputs).forEach((input) => {
                    const [inpName, inpState] = input;

                    Object.entries(this.inputs).forEach((nodeInterface) => {
                        const [, intfState] = nodeInterface;

                        if (inpState.id === intfState.id) {
                            if (intfState.port) {
                                newInputs[inpName] = {
                                    id: inpState.id,
                                };
                            } else {
                                newProperties[inpName] = {
                                    id: inpState.id,
                                    value: inpState.value === undefined ? null : inpState.value,
                                };
                            }
                        }
                    });
                });

                savedState.inputs = newInputs;
                savedState.properties = newProperties;

                savedState.name = savedState.title;
                delete savedState.title;

                return savedState;
            };

            this.load = (state) => {
                Object.entries(state.properties).forEach((prop) => {
                    const [propName, propState] = prop;
                    state.inputs[propName] = propState;
                });

                delete state.properties;

                if ('name' in state) {
                    state.title = state.name;
                } else {
                    state.title = '';
                }
                delete state.name;

                this.parentLoad(state);
            };

            this.twoColumn = twoColumn;
        },
    });

    return node;
}

/**
 * Function that reads all nodes in the specification and creates `NodeInterfaceType` objects for
 * their inputs' and outputs' types so that a simple validation based on those
 * types can be performed.
 *
 * The read interface types are stored in `interfaceTypes` object which is returned by this function
 * @param {*} nodes nodes of the specification
 * @returns read interface types
 */
export function readInterfaceTypes(nodes) {
    const interfaceTypes = {};

    nodes.forEach((node) => {
        [...node.inputs, ...node.outputs].forEach((io) => {
            if (!Object.prototype.hasOwnProperty.call(interfaceTypes, io.type)) {
                interfaceTypes[io.type] = new NodeInterfaceType(io.type);
            }
        });
    });

    return interfaceTypes;
}
