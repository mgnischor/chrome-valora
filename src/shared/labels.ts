/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/labels.ts
    Description: Message keys of the texts that belong to calculators, derived from their ids by convention.
    Author: Miguel Nischor <miguel@nischor.com.br>

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
import type { GroupId } from "../core/types";
import type { MessageKey } from "./i18n";

/**
 * The names of the texts of calculators are built from their ids instead of
 * being listed one by one. The keys cannot be checked by the compiler, so
 * `tests/i18n.test.ts` verifies that every calculator, field, output and
 * choice has a message in every locale.
 */

/**
 * @param group - Group id.
 * @returns Key of the group heading.
 */
export const groupKey = (group: GroupId): MessageKey => `group_${group}` as MessageKey;

/**
 * @param calculator - Calculator id.
 * @returns Key of the calculator's name.
 */
export const calculatorNameKey = (calculator: string): MessageKey => `calc_${calculator}_name` as MessageKey;

/**
 * @param calculator - Calculator id.
 * @returns Key of the calculator's one-sentence description.
 */
export const calculatorDescriptionKey = (calculator: string): MessageKey => `calc_${calculator}_desc` as MessageKey;

/**
 * @param calculator - Calculator id.
 * @returns Key of the calculator's plain-text formula.
 */
export const calculatorFormulaKey = (calculator: string): MessageKey => `calc_${calculator}_formula` as MessageKey;

/**
 * @param calculator - Calculator id.
 * @param field - Field id.
 * @returns Key of the field's label.
 */
export const fieldKey = (calculator: string, field: string): MessageKey => `field_${calculator}_${field}` as MessageKey;

/**
 * @param calculator - Calculator id.
 * @param output - Output id.
 * @returns Key of the result's label.
 */
export const outputKey = (calculator: string, output: string): MessageKey =>
    `out_${calculator}_${output}` as MessageKey;

/**
 * @param calculator - Calculator id.
 * @param field - Field id of a `choice` field.
 * @param value - One of the field's choices.
 * @returns Key of the text of that option.
 */
export const choiceKey = (calculator: string, field: string, value: number): MessageKey =>
    `choice_${calculator}_${field}_${value}` as MessageKey;
