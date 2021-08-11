import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormlyFormOptions, FormlyFieldConfig } from '@ngx-formly/core';
import { FormlyJsonschema } from '@ngx-formly/core/json-schema';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import {JSONSchema7, JSONSchema7Definition} from "json-schema";
import { cloneDeep } from 'lodash';

@Component({
  selector: 'formly-app-example',
  templateUrl: './app.component.html',
})
export class AppComponent {
  form: FormGroup;
  modelWithAdditionalPropertiesAsArrays: any;
  options: FormlyFormOptions;
  fields: FormlyFieldConfig[];

  type: string;
  examples = [
    'simple',
  ];

  constructor(
    private formlyJsonschema: FormlyJsonschema,
    private http: HttpClient,
  ) {
    this.loadExample(this.examples[0]);
  }

  loadExample(type: string) {
    this.http.get<any>(`assets/json-schema/${type}.json`).pipe(
      tap(({ schema, model }) => {
        this.type = type;
        this.form = new FormGroup({});
        this.options = {};
        this.fields = [
            this.formlyJsonschema.toFieldConfig(schema, {
              map: (field: FormlyFieldConfig, source: JSONSchema7): FormlyFieldConfig => {
                if (source.additionalProperties) {
                  return this.resolveAdditionalPropertiesSchema(
                    source,
                    field,
                    schema,
                  );
                }
                return field;
              },
            })
        ];
        this.modelWithAdditionalPropertiesAsArrays = cloneDeep(
            this.convertAdditionalPropertiesToArray(model, this.fields[0]),
        );
      }),
    ).subscribe();
  }

  submit() {
    const values = this.convertAdditionalPropertiesToObject(
        this.modelWithAdditionalPropertiesAsArrays,
    );

    console.log(JSON.stringify(values, null, '\t'));
  }

  private resolveAdditionalPropertiesSchema(
      schemas: JSONSchema7,
      field: FormlyFieldConfig,
      rootSchema: JSONSchema7,
  ): FormlyFieldConfig {
    const additionalPropertySchema: JSONSchema7 = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: {
            title: 'Ключ',
            type: 'string',
          },
          value: schemas.additionalProperties as JSONSchema7Definition,
        },
      },
    };

    (field.fieldGroup as FormlyFieldConfig[]).push(
        this.formlyJsonschema.toFieldConfig(additionalPropertySchema, {
          // @ts-ignore
          key: 'additionalProperties',
          schema: rootSchema,
        }),
    );

    return {
      ...field,
      type: 'additionalProperties',
    };
  }

  private convertAdditionalPropertiesToObject(model: any): any {
    if (typeof model === 'object') {
      if (Array.isArray(model)) {
        return model.map((item) => this.convertAdditionalPropertiesToObject(item));
      }
      const result: any = {};
      Object.keys(model).forEach((prop) => {
        if (prop === 'additionalProperties') {
          if (model[prop]) {
            model[prop].forEach((item: any) => {
              if (item) {
                result[item.key] = this.convertAdditionalPropertiesToObject(item.value);
              }
            });
          }
        } else {
          result[prop] = this.convertAdditionalPropertiesToObject(model[prop]);
        }
      });
      return result;
    }
    return model;
  }

  private convertAdditionalPropertiesToArray(model: any, field: FormlyFieldConfig | null): any {
    if (typeof model === 'object') {
      if (Array.isArray(model)) {
        return model.map((item) => {
          return this.convertAdditionalPropertiesToArray(item, field?.fieldArray || null);
        });
      }
      const result: any = {};
      const isAdditionalPropertiesType = field?.type === 'additionalProperties';

      Object.keys(model).forEach((prop) => {
        const subField = field?.fieldGroup?.find((item) => item.key === prop);

        if (isAdditionalPropertiesType) {
          if (subField) {
            result[prop] = this.convertAdditionalPropertiesToArray(model[prop], subField);
          } else {
            const additionalPropertiesField = field?.fieldGroup?.find(
                (item) => item.key === 'additionalProperties',
            );

            if (!result.additionalProperties) {
              result.additionalProperties = [];
            }

            result.additionalProperties.push({
              key: prop,
              value: this.convertAdditionalPropertiesToArray(
                  model[prop],
                  additionalPropertiesField?.fieldArray?.fieldGroup?.[1] || null,
              ),
            });
          }
        } else {
          result[prop] = this.convertAdditionalPropertiesToArray(model[prop], subField || null);
        }
      });
      return result;
    }
    return model;
  }
}


/**  Copyright 2018 Google Inc. All Rights Reserved.
    Use of this source code is governed by an MIT-style license that
    can be found in the LICENSE file at http://angular.io/license */
