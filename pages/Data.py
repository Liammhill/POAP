import dash
from dash import html, dcc, dash_table
import pandas as pd
from Dashboard import df

df["Date"] = pd.to_datetime(df["Date"], format="%Y-%m-%d", errors = "coerce")
df = df.sort_values(by="Date")
selected_columns = ['Project', 'Milestone', 'Director Ask', 'Director Deadline']

dash.register_page(__name__)

layout = html.Div([
    html.H1('Data'),
    dash_table.DataTable(df.to_dict('records'), [{"name": i, "id": i} for i in df.columns], sort_action='native', filter_action='native')
])
