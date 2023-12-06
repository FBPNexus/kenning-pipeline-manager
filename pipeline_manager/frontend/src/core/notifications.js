/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Handles incoming notifications from Pipeline Manager: creates toast
 * notifications (popup), adds them to store for notifications panel,
 * logs appropriate notification to terminal window
 */

import { createToastInterface, POSITION } from 'vue-toastification';
import { notificationStore, terminalStore } from './stores.js';
import Notification from '../components/Notification.vue';
import EditorManager from './EditorManager';

const toast = createToastInterface({
    timeout: 5000,
    position: POSITION.BOTTOM_RIGHT,
    icon: false,
    closeButton: false,
});

export const LOG_LEVEL = {
    info: 0,
    warning: 1,
    error: 2,
};

export default class NotificationHandler {
    static NotificationHandler = true;

    static defaultShowOption = true;

    /**
     * Sets the showNotification flag. If set to false, no popup
     * notifications are shown
     *
     * @param show new value for showNotification
     */
    static setShowNotification(show) {
        NotificationHandler.showNotifications = show;
    }

    /**
     * Sets the default showNotification flag value.
     * Does not change whether the notifications are actually set or not,
     * this should be done in `setShowNotification` or `restoreShowNotification`
     * methods
     *
     * @param showOption default value for showNotification flag
     */
    static setShowOption(showOption) {
        NotificationHandler.defaultShowOption = showOption;
    }

    /**
     * Restores show notification flag to it's default value
     */
    static restoreShowNotification() {
        NotificationHandler.showNotifications = NotificationHandler.defaultShowOption;
    }

    static showToast(type, message) {
        const content = {
            component: Notification,
            props: {
                type,
                message,
            },
        };

        if (
            LOG_LEVEL[type] >= LOG_LEVEL[
                EditorManager.getEditorManagerInstance().baklavaView.logLevel?.toLowerCase()
            ] && NotificationHandler.showNotifications
        ) {
            toast(content);
        } else {
            const bell = document.querySelector('#navbar-bell>.indicator');
            if (bell) {
                bell.classList.remove('animate');
                setTimeout(() => bell.classList.add('animate'), 300);
            }
        }
        notificationStore.add({ type, message });
    }

    /**
     * Helper function that displays the title of the message as a toast notification and
     * a full message in terminal with a proper title.
     *
     * @param {string} type Type of the toast notification
     * @param {string} title Title of the message used both for toast and terminal notification.
     * Preferably without any punctuation marks at the end
     * @param {Array[string] | string | undefined} messages messages that are displayed in
     * the terminal
     */
    static terminalLog(type, title, messages) {
        NotificationHandler.showToast(type, title);
        terminalStore.addParsed(title, messages);
    }
}
