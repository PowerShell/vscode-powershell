console.log("What the hell....");
var commands = {
    "Name":  "__a",
    "Module":  null,
    "Parameters":  {
                       "test":  {
                                    "Name":  "test",
                                    "ParameterType":  "System.Object",
                                    "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                    "IsDynamic":  false,
                                    "Aliases":  "",
                                    "Attributes":  "System.Management.Automation.ParameterAttribute",
                                    "SwitchParameter":  false
                                },
                       "mine":  {
                                    "Name":  "mine",
                                    "ParameterType":  "System.Object",
                                    "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                    "IsDynamic":  false,
                                    "Aliases":  "",
                                    "Attributes":  "System.Management.Automation.ParameterAttribute",
                                    "SwitchParameter":  false
                                },
                       "Verbose":  {
                                       "Name":  "Verbose",
                                       "ParameterType":  "switch",
                                       "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                       "IsDynamic":  false,
                                       "Aliases":  "vb",
                                       "Attributes":  "System.Management.Automation.AliasAttribute System.Management.Automation.ParameterAttribute",
                                       "SwitchParameter":  true
                                   },
                       "Debug":  {
                                     "Name":  "Debug",
                                     "ParameterType":  "switch",
                                     "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                     "IsDynamic":  false,
                                     "Aliases":  "db",
                                     "Attributes":  "System.Management.Automation.ParameterAttribute System.Management.Automation.AliasAttribute",
                                     "SwitchParameter":  true
                                 },
                       "ErrorAction":  {
                                           "Name":  "ErrorAction",
                                           "ParameterType":  "System.Management.Automation.ActionPreference",
                                           "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                           "IsDynamic":  false,
                                           "Aliases":  "ea",
                                           "Attributes":  "System.Management.Automation.AliasAttribute System.Management.Automation.ParameterAttribute",
                                           "SwitchParameter":  false
                                       },
                       "WarningAction":  {
                                             "Name":  "WarningAction",
                                             "ParameterType":  "System.Management.Automation.ActionPreference",
                                             "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                             "IsDynamic":  false,
                                             "Aliases":  "wa",
                                             "Attributes":  "System.Management.Automation.AliasAttribute System.Management.Automation.ParameterAttribute",
                                             "SwitchParameter":  false
                                         },
                       "InformationAction":  {
                                                 "Name":  "InformationAction",
                                                 "ParameterType":  "System.Management.Automation.ActionPreference",
                                                 "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                                 "IsDynamic":  false,
                                                 "Aliases":  "infa",
                                                 "Attributes":  "System.Management.Automation.ParameterAttribute System.Management.Automation.AliasAttribute",
                                                 "SwitchParameter":  false
                                             },
                       "ErrorVariable":  {
                                             "Name":  "ErrorVariable",
                                             "ParameterType":  "string",
                                             "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                             "IsDynamic":  false,
                                             "Aliases":  "ev",
                                             "Attributes":  "System.Management.Automation.Internal.CommonParameters+ValidateVariableName System.Management.Automation.AliasAttribute System.Management.Automation.ParameterAttribute",
                                             "SwitchParameter":  false
                                         },
                       "WarningVariable":  {
                                               "Name":  "WarningVariable",
                                               "ParameterType":  "string",
                                               "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                               "IsDynamic":  false,
                                               "Aliases":  "wv",
                                               "Attributes":  "System.Management.Automation.ParameterAttribute System.Management.Automation.AliasAttribute System.Management.Automation.Internal.CommonParameters+ValidateVariableName",
                                               "SwitchParameter":  false
                                           },
                       "InformationVariable":  {
                                                   "Name":  "InformationVariable",
                                                   "ParameterType":  "string",
                                                   "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                                   "IsDynamic":  false,
                                                   "Aliases":  "iv",
                                                   "Attributes":  "System.Management.Automation.AliasAttribute System.Management.Automation.ParameterAttribute System.Management.Automation.Internal.CommonParameters+ValidateVariableName",
                                                   "SwitchParameter":  false
                                               },
                       "OutVariable":  {
                                           "Name":  "OutVariable",
                                           "ParameterType":  "string",
                                           "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                           "IsDynamic":  false,
                                           "Aliases":  "ov",
                                           "Attributes":  "System.Management.Automation.AliasAttribute System.Management.Automation.ParameterAttribute System.Management.Automation.Internal.CommonParameters+ValidateVariableName",
                                           "SwitchParameter":  false
                                       },
                       "OutBuffer":  {
                                         "Name":  "OutBuffer",
                                         "ParameterType":  "int",
                                         "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                         "IsDynamic":  false,
                                         "Aliases":  "ob",
                                         "Attributes":  "System.Management.Automation.ParameterAttribute System.Management.Automation.ValidateRangeAttribute System.Management.Automation.AliasAttribute",
                                         "SwitchParameter":  false
                                     },
                       "PipelineVariable":  {
                                                "Name":  "PipelineVariable",
                                                "ParameterType":  "string",
                                                "ParameterSets":  "System.Collections.Generic.Dictionary`2[System.String,System.Management.Automation.ParameterSetMetadata]",
                                                "IsDynamic":  false,
                                                "Aliases":  "pv",
                                                "Attributes":  "System.Management.Automation.AliasAttribute System.Management.Automation.ParameterAttribute System.Management.Automation.Internal.CommonParameters+ValidateVariableName",
                                                "SwitchParameter":  false
                                            }
                   },
    "ParameterSets":  [
                          {
                              "Name":  "__AllParameterSets",
                              "IsDefault":  false,
                              "Parameters":  "System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo System.Management.Automation.CommandParameterInfo"
                          }
                      ]
}
