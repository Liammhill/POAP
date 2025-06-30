import dash
from dash import html, dcc, dash_table
import pandas as pd

df = pd.read_csv('pages/df.csv')
df["Date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y")
df = df.sort_values(by="Date")
selected_columns = ['Project', 'Milestone', 'Director Ask', 'Director Deadline']
df2 = df[selected_columns]

dash.register_page(__name__)

layout = html.Div([
    html.H1('Data'),
    dash_table.DataTable(df.to_dict('records'), [{"name": i, "id": i} for i in df.columns], sort_action='native', filter_action='native')
])