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
    GraphTemplate,
} from 'baklavajs';
import { v4 as uuidv4 } from 'uuid';

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
                tempInputs[`property_${propName}`] = () => {
                    const intf = new TextInterface(propName, propDef).setPort(false);
                    intf.componentName = 'TextInterface';
                    return intf;
                };
                break;
            case 'text':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new InputInterface(propName, propDef).setPort(false);
                    intf.componentName = 'InputInterface';
                    return intf;
                };
                break;
            case 'number':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new NumberInterface(propName, propDef).setPort(false);
                    intf.componentName = 'NumberInterface';
                    return intf;
                };
                break;
            case 'integer':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new IntegerInterface(propName, propDef).setPort(false);
                    intf.componentName = 'IntegerInterface';
                    return intf;
                };
                break;
            case 'select': {
                const it = p.values.map((element) => element.toString());
                tempInputs[`property_${propName}`] = () => {
                    const intf = new SelectInterface(propName, propDef, it).setPort(false);
                    intf.componentName = 'SelectInterface';
                    return intf;
                };
                break;
            }
            case 'checkbox':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new CheckboxInterface(propName, propDef).setPort(false);
                    intf.componentName = 'CheckboxInterface';
                    return intf;
                };
                break;
            case 'slider':
                if (propDef === undefined) {
                    propDef = p.min;
                }
                tempInputs[`property_${propName}`] = () => {
                    const intf = new SliderInterface(propName, propDef, p.min, p.max).setPort(
                        false,
                    );
                    intf.componentName = 'SliderInterface';
                    return intf;
                };
                break;
            case 'list':
                tempInputs[`property_${propName}`] = () => {
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

function createInterface(io, name = undefined) {
    return () => {
        const intf = new NodeInterface(name ?? io.name);
        intf.type = typeof io.type === 'string' || io.type instanceof String ? [io.type] : io.type;
        intf.componentName = 'NodeInterface';
        intf.maxConnectionsCount = io.maxConnectionsCount;
        intf.direction = io.direction;
        intf.side = io.side ?? (io.direction === 'output' ? 'right' : 'left');
        return intf;
    };
}

/* eslint-disable no-lonely-if */
function parseIntefaces(interfaces) {
    const tempIO = {
        input: {},
        inout: {},
        output: {},
    };

    // TODO storing inouts currently in the same list as inputs (since they are already
    // handling other things than inputs, such as paramters)
    interfaces.forEach((io) => {
        if (io.array !== undefined) {
            const [left, right] = io.array;

            for (let j = left; j < right; j += 1) {
                const newName = `${io.name}[${j}]`;
                tempIO[io.direction][newName] = createInterface(io, newName);
            }
        } else {
            tempIO[io.direction][io.name] = createInterface(io);
        }
    });

    const filteredInouts = Object.fromEntries(
        Object.entries(tempIO.inout).filter(
            ([name]) =>
                !Object.keys(tempIO.output).includes(name) &&
                !Object.keys(tempIO.input).includes(name),
        ),
    );

    const renamedInputs = Object.fromEntries(
        Object.entries(tempIO.input).map(([name, constructor]) => [`input_${name}`, constructor]),
    );
    const renamedInouts = Object.fromEntries(
        Object.entries(filteredInouts).map(([name, constructor]) => [`inout_${name}`, constructor]),
    );
    const renamedOutputs = Object.fromEntries(
        Object.entries(tempIO.output).map(([name, constructor]) => [`output_${name}`, constructor]),
    );

    return {
        inputs: { ...renamedInouts, ...renamedInputs },
        outputs: renamedOutputs,
    };
}

function parseNodeState(state) {
    const newState = { ...state };
    if (newState.inputs === undefined) {
        newState.inputs = {};
    }
    if (newState.outputs === undefined) {
        newState.outputs = {};
    }

    if (newState.interfaces !== undefined) {
        newState.interfaces.forEach((intf) => {
            if (intf.direction === 'input' || intf.direction === 'inout') {
                newState.inputs[`${intf.direction}_${intf.name}`] = { ...intf };
            } else if (intf.direction === 'output') {
                newState.outputs[`${intf.direction}_${intf.name}`] = { ...intf };
            }
        });

        delete newState.interfaces;
    }

    if (newState.properties !== undefined) {
        newState.properties.forEach((prop) => {
            newState.inputs[`property_${prop.name}`] = { ...prop };
        });
        delete newState.properties;
    }

    if ('name' in newState) {
        newState.title = newState.name;
    } else {
        newState.title = '';
    }
    delete newState.name;

    return newState;
}

/**
 * Function perfomrms sanity checking on parsed state before loading it
 * into the editor. It should throw explicit errors if any discrepancy is detected.
 *
 * @param {*} parsedState that is passed to node to load
 * @param {*} inputs inputs of the node
 * @param {*} outputs outputs of the node
 */
function detectDiscrepancies(parsedState, inputs, outputs) {
    const errors = [];

    Object.entries({ ...parsedState.inputs, ...parsedState.outputs }).forEach(([ioName]) => {
        if (
            !Object.prototype.hasOwnProperty.call(inputs, ioName) &&
            !Object.prototype.hasOwnProperty.call(outputs, ioName)
        ) {
            const direction = ioName.slice(0, ioName.indexOf('_'));
            const name = ioName.slice(ioName.indexOf('_') + 1);

            errors.push(
                `Node of name ${parsedState.type} and id ${parsedState.id} is corrupted. ` +
                    `Interface named - ${name} of direction - ${direction} not found in specification!`,
            );
        }
    });
    return errors;
}

/**
 * Class factory that creates a class for a custom Node that is described by the arguments.
 * It can be later registered so that the user can use it and save the editor.
 * `inputs`, `properties` and `outputs` formats are described in the documentation.
 *
 * @param {string} name Name of the block that is stored when saving
 * @param {string} displayName Name of the block displayed to the user
 * @param {string} type Type of the node
 * @param {*} interfaces List of interfaces in the block (input, output and inout)
 * @param {*} properties List of properties of the block
 * @param {boolean} twoColumn type of layout of the nodes
 * @returns Node based class
 */
export function NodeFactory(name, displayName, nodeType, interfaces, properties, twoColumn) {
    const node = defineNode({
        type: name,

        title: displayName,

        inputs: { ...parseIntefaces(interfaces).inputs, ...parseProperties(properties) },
        outputs: parseIntefaces(interfaces).outputs,

        /* eslint-disable no-param-reassign */
        onCreate() {
            this.nodeType = nodeType;
            this.parentSave = this.save;
            this.parentLoad = this.load;

            this.save = () => {
                const savedState = this.parentSave();

                const newProperties = [];
                const newInterfaces = [];

                Object.entries({ ...this.inputs, ...this.outputs }).forEach((io) => {
                    const [ioName, ioState] = io;

                    if (ioState.port) {
                        newInterfaces.push({
                            name: ioName.slice(ioState.direction.length + 1),
                            id: ioState.id,
                            direction: ioState.direction,
                            side: ioState.side,
                        });
                    } else {
                        newProperties.push({
                            name: ioName.slice('property'.length + 1),
                            id: ioState.id,
                            value: ioState.value === undefined ? null : ioState.value,
                        });
                    }
                });

                delete savedState.inputs;
                delete savedState.outputs;
                savedState.interfaces = newInterfaces;
                savedState.properties = newProperties;

                savedState.name = savedState.title;
                delete savedState.title;

                return savedState;
            };

            this.load = (state) => {
                const parsedState = parseNodeState(state);

                const errors = detectDiscrepancies(parsedState, this.inputs, this.outputs);
                if (Array.isArray(errors) && errors.length) {
                    return errors;
                }

                this.parentLoad(parsedState);

                // Assinging sides to interfaces if any are defined
                Object.entries({ ...parsedState.inputs, ...parsedState.outputs }).forEach(
                    ([ioName, ioState]) => {
                        if (ioState.direction !== undefined && ioState.side !== undefined) {
                            if (ioState.direction === 'input' || ioState.direction === 'inout') {
                                this.inputs[ioName].side = ioState.side;
                            } else if (ioState.direction === 'output') {
                                this.outputs[ioName].side = ioState.side;
                            }
                        }
                    },
                );

                // Default position should be undefined instead of (0, 0) so that it can be set
                // by autolayout
                if (state.position === undefined) {
                    this.position = undefined;
                }
                return [];
            };

            this.twoColumn = twoColumn;
        },
    });

    return node;
}

/**
 * Function creating the subgraph template as defined in specification
 *
 * @param nodes Nodes of the subgraph
 * @param connections Connections inside the subgraph
 * @param interfaces Inputs and outputs
 * @param name Default name that will be displayed in editor
 * @param type Type of the subgraph. Used to define which template should be used
 * when new subgraph node is create
 * @param editor PipelineManagerEditor instance
 * @returns Graph template that will be used to define the subgraph node
 */
export function SubgraphFactory(nodes, connections, interfaces, name, type, editor) {
    const inputs = interfaces
        .filter((interf) => interf.direction === 'input' || interf.direction === 'inout')
        .map((interf) => ({
            id: interf.id ?? uuidv4(),
            nodeInterfaceId: interf.nodeInterface,
            name: interf.name,
            direction: interf.direction,
        }));
    const outputs = interfaces
        .filter((interf) => interf.direction === 'output')
        .map((interf) => ({
            id: interf.id ?? uuidv4(),
            nodeInterfaceId: interf.nodeInterface,
            name: interf.name,
            direction: interf.direction,
        }));

    const state = {
        id: type,
        nodes: nodes.map(parseNodeState),
        connections,
        inputs,
        outputs,
        name,
    };
    return new GraphTemplate(state, editor);
}
