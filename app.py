# app.py
from flask import Flask, render_template, request, jsonify
import pandas as pd

app = Flask(__name__)

# Load product data
def load_products():
    # Assuming products.csv has columns: id, name, price, category, brand, description, rating
    return pd.read_csv('products_3.csv')

# Routes
@app.route('/')
def home():
    products_df = load_products()
    categories = products_df['category'].unique().tolist()
    brands = products_df['brand'].unique().tolist()
    
    # Get filter values from query parameters
    selected_categories = request.args.getlist('category')
    selected_brands = request.args.getlist('brand')
    price_range = request.args.get('price_range', '500')
    customer_id = request.args.get('customer_id', '')
    search_query = request.args.get('search', '')

    # Apply filters if they exist
    if any([selected_categories, selected_brands, search_query]):
        filtered_products = filter_products(
            df=products_df, 
            categories=selected_categories, 
            brands=selected_brands, 
            max_price=int(price_range), 
            search=search_query
        )
    else:
        filtered_products = products_df

    return render_template('index.html',
                         products=filtered_products.to_dict('records'),
                         categories=categories,
                         brands=brands,
                         selected_categories=selected_categories,
                         selected_brands=selected_brands,
                         price_range=price_range,
                         customer_id=customer_id,
                         search_query=search_query)


@app.route('/product/<int:product_id>')
def product_detail(product_id):
    products_df = load_products()
    product = products_df[products_df['id'] == product_id].iloc[0].to_dict()
    
    # Get filter values from query parameters
    customer_id = request.args.get('customer_id', '')
    
    return render_template('product.html', 
                         product=product,
                         customer_id=customer_id)

@app.route('/filter', methods=['POST'])
def filter_products(df, categories=None, brands=None, max_price=None, search=None):
    filtered_df = df.copy()
    
    if categories:
        filtered_df = filtered_df[filtered_df['category'].isin(categories)]
    
    if brands:
        filtered_df = filtered_df[filtered_df['brand'].isin(brands)]
    
    if max_price:
        filtered_df = filtered_df[filtered_df['price'] <= max_price]
    
    if search:
        filtered_df = filtered_df[
            filtered_df['name'].str.contains(search, case=False) |
            filtered_df['description'].str.contains(search, case=False)
        ]
    
    return filtered_df

@app.route('/chatbot', methods=['POST'])
def chatbot():
    data = request.json
    message = data['message']
    context = data.get('context', {})
    customer_id = data.get('customerId')
    
    if not customer_id:
        return jsonify({
            "error": "Customer ID required",
            "response": "Please provide your Customer ID to continue."
        }), 400
    
    # Here you could add logic to retrieve customer-specific information
    # and personalize the response based on their history
    
    if context and 'Product:' in context:
        response = f"I understand you're asking about {context}. How can I help you with this product?"
    else:
        response = f"Thank you for your message, Customer {customer_id}. How can I help you today?"
    
    return jsonify({"response": response})

if __name__ == '__main__':
    app.run(debug=True)
