
import dash
from dash import Dash, html, dcc
#import random
import dash_bootstrap_components as dbc
import dash_auth

print(dash.__version__)

#navbar

VALID_USERNAME_PASSWORD_PAIRS = {
    'hello': 'world'
}

#start of dash app
external_stylesheets = [dbc.themes.LUX]

app = Dash(__name__, use_pages=True,external_stylesheets=external_stylesheets)
auth = dash_auth.BasicAuth(
    app,
    VALID_USERNAME_PASSWORD_PAIRS
)
server = app.server

dropdown = dbc.DropdownMenu(
    label="More Pages",
    children=[
        dbc.DropdownMenuItem(page["name"], href=page["relative_path"])
        for page in dash.page_registry.values()
    ],
    nav=True, in_navbar=True
)

navbar = dbc.NavbarSimple(
    children=[dropdown],
    brand="POAP MVP",
    brand_href="/",
    color="primary",
    dark=True,
)

app.layout = html.Div([
    navbar,
    dash.page_container
])

if __name__ == '__main__':
    app.run(debug=True)

print(dash.page_registry.values())
