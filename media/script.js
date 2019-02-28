const vscode = acquireVsCodeApi();
        const command = document.getElementById('CommandDiv');
        var message;
        window.addEventListener('message', event => {
            message = undefined;
            // Remove previous nodes if there are any.
            while (command.hasChildNodes()) {
                command.removeChild(command.childNodes[0])
            }
            window.myMessage = event.data[0];
            message = event.data[0];
            console.log(message);
            for (var parameter in message.parameters) {
                let parameterLabel = document.createElement('label');
                parameterLabel.htmlFor = message.parameters[parameter].name;
                parameterLabel.innerText = message.parameters[parameter].name;
                if (message.parameters[parameter].attributes[0].mandatory) {
                    parameterLabel.innerText += ' *';
                }
                command.appendChild(parameterLabel);
                let parameterInput = document.createElement('input');
                parameterInput.id = message.parameters[parameter].name;
                command.appendChild(parameterInput);
                command.appendChild(document.createElement('br'));
            }
        });
        function mySubmit() {
            let myMessage = message;
            myMessage.filledParameters = {};
            command.childNodes.forEach((node) => {
                if (node.tagName === "INPUT" && node.value !== "") {
                    myMessage.filledParameters[node.id] = node.value
                }
            });
            vscode.postMessage(myMessage);
        }