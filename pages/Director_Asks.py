import pandas as pd
import dash
from dash import html, dash_table

dash.register_page(__name__)
df = pd.read_csv('pages/df.csv')
selected_columns = ['Project', 'Milestone', 'Director Ask', 'Director Deadline']
df2 = df[selected_columns]

layout = html.Div([
    html.H1('Director Asks'),
    dash_table.DataTable(df2.to_dict('records'), [{"name": i, "id": i} for i in df2.columns], sort_action='native', filter_action='native')
])