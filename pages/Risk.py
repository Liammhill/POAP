import pandas as pd
import dash
from dash import html, dash_table, dcc
import plotly.express as px


df = pd.read_csv('pages/df_risk.csv')

fig = px.scatter(df, x= 'Likelihood', y='Severity', symbol = 'Proximity', hover_data={'Project', 'Risk Description'})

dash.register_page(__name__)

layout = html.Div([html.H1('Risk'),
                   dcc.Graph(id="scatter-graph",figure=fig, style={'width': '100%', 'height': '85vh'}),
                   dash_table.DataTable(df.to_dict('records'), [{"name": i, "id": i} for i in df.columns], sort_action='native', filter_action='native'),
                   ])