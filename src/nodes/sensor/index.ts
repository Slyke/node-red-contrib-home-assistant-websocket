import Joi from 'joi';
import { NodeDef } from 'node-red';

import { createControllerDependencies } from '../../common/controllers/helpers';
import {
    SensorBaseNode,
    SensorBaseNodeProperties,
} from '../../common/controllers/SensorBaseController';
import ClientEvents from '../../common/events/ClientEvents';
import Events from '../../common/events/Events';
import InputService, { NodeInputs } from '../../common/services/InputService';
import State from '../../common/State';
import EventsStatus from '../../common/status/EventStatus';
import { TypedInputTypes } from '../../const';
import { RED } from '../../globals';
import { migrate } from '../../helpers/migrate';
import { getConfigNodes } from '../../helpers/node';
import { getHomeAssistant } from '../../homeAssistant';
import SensorController from './SensorController';

export type SensorNodeProperties = SensorBaseNodeProperties;

export interface SensorNode extends SensorBaseNode {
    config: SensorNodeProperties;
}

const inputs: NodeInputs = {
    state: {
        messageProp: 'payload.state',
        configProp: 'state',
        default: 'payload',
    },
    stateType: {
        messageProp: 'payload.stateType',
        configProp: 'stateType',
        default: TypedInputTypes.Message,
    },
    attributes: {
        messageProp: 'payload.attributes',
        configProp: 'attributes',
        default: [],
    },
};

const inputSchema: Joi.ObjectSchema = Joi.object({
    state: Joi.string().default('payload'),
    stateType: Joi.string()
        .valid(
            TypedInputTypes.Message,
            TypedInputTypes.Flow,
            TypedInputTypes.Global,
            TypedInputTypes.JSONata,
            TypedInputTypes.String,
            TypedInputTypes.Number,
            TypedInputTypes.Boolean
        )
        .default('msg'),
    attributes: Joi.object().pattern(/.*/, [
        Joi.string(),
        Joi.number(),
        Joi.boolean(),
        Joi.object(),
    ]),
});

export default function Sensor(this: SensorNode, config: NodeDef) {
    RED.nodes.createNode(this, config);

    this.config = migrate(config);

    const { entityConfigNode, serverConfigNode } = getConfigNodes(this);
    const homeAssistant = getHomeAssistant(serverConfigNode);
    const clientEvents = new ClientEvents({
        node: this,
        emitter: homeAssistant.eventBus,
    });
    const nodeEvents = new Events({ node: this, emitter: this });
    const state = new State(this);
    const status = new EventsStatus({
        config: serverConfigNode.config,
        clientEvents,
        nodeEvents,
        node: this,
        state,
    });
    const controllerDeps = createControllerDependencies(this, homeAssistant);
    const inputService = new InputService<SensorNodeProperties>({
        inputs,
        nodeConfig: this.config,
        schema: inputSchema,
    });

    // eslint-disable-next-line no-new
    new SensorController({
        homeAssistant,
        inputService,
        node: this,
        status,
        integration: entityConfigNode.integration,
        ...controllerDeps,
    });
}