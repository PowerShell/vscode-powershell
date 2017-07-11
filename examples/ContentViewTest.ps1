$params = @{
    HtmlBodyContent = "Testing JavaScript and CSS paths..."
    JavaScriptPaths = ".\Assets\script.js"
    StyleSheetPaths = ".\Assets\style.css"
}

$view = New-VSCodeHtmlContentView -Title "Test View" -ShowInColumn Two
Set-VSCodeHtmlContentView -View $view @params