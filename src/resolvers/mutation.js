import bcrypt from "bcryptjs"

import User from "../models/user"
import Product from "../models/product"
import CartItem from "../models/cartItem"

const Mutation = {
  signup: async (parent, args, context, info) => {
    // Trim and lower case email
    const email = args.email.trim().toLowerCase()

    // Check if email already exist in database
    const currentUsers = await User.find({})
    const isEmailExist =
      currentUsers.findIndex(user => user.email === email) > -1

    if (isEmailExist) {
      throw new Error("Email already exist.")
    }

    // Validate password
    if (args.password.trim().length < 6) {
      throw new Error("Password must be at least 6 characters.")
    }

    const password = await bcrypt.hash(args.password, 10)

    return User.create({ ...args, email, password })
  },

  createProduct: async (parent, args, {userId}, info) => {
    //check user log in
    //const userId = "5e132cabae30211b84ad5d4f"
    if(!userId){
      throw new Error("Please Log in.");
    }
    if (!args.description || !args.price || !args.imageUrl) {
      throw new Error("Please provide all required fields.")
    }

    const product = await Product.create({ ...args, user: userId })
    const user = await User.findById(userId)

    if (!user.products) {
      user.products = [product]
    } else {
      user.products.push(product)
    }

    await user.save()

    return Product.findById(product.id).populate({
      path: "user",
      populate: { path: "products" }
    })
  },

  updateProduct: async (parent, args, { userId }, info) =>{
    const {id, description, price, imageUrl} = args;

    
    //For Login
    //check user log in
    if (!userId) throw new Error("Please log in.")

    //const userId = "5f34b25d7f67752fb8d4790c";

    //check user is owner of product
    const product = await Product.findById(id);

    if(userId !== product.user.toString()){
      throw new Error("You are not authorized.");
    }

    //update information
    const updateInfo ={
      description: !!description ? description : product.description,
      price: !!price ? price : product.price,
      imageUrl: !!imageUrl ? imageUrl : product.imageUrl
    };

    //update product in DB
    await Product.findByIdAndUpdate(id, updateInfo);

    //Find Updated product
    const updatedProduct = await Product.findById(id)
    .populate({path: "user"});

    return updatedProduct;
  },
  
  addToCart: async (parent, args, {userId}, info) => {
    // id --> productId
    const { id } = args

    try {
      //check user log in
      //const userId = "5f34b25d7f67752fb8d4790c";
      if(!userId)throw new Error("Please log in.")

      const user = await User.findById(userId)
      .populate({
        path: "carts", 
        populate: {path: "product"}
      });

      const findCartItemIndex = user.carts.findIndex(cartItem => cartItem.product.id === id);
      
      if(findCartItemIndex > -1){
        user.carts[findCartItemIndex].quantity += 1
        await CartItem.findByIdAndUpdate(user.carts[findCartItemIndex].id, {
          quantity: user.carts[findCartItemIndex].quantity
        });

        const updateCartItem = await CartItem.findById(user.carts[findCartItemIndex].id)
        .populate({path: "product"})
        .populate({path: "user"});

        return updateCartItem;
      } 
      else{
        const cartItem = await CartItem.create({
          product: id,
          quantity: 1,
          user: userId
        });

        const newCartItem = await CartItem.findById(cartItem.id)
        .populate({path: "product"})
        .populate({path: "user"});

        await User.findByIdAndUpdate(userId, {
          carts: [...user.carts, newCartItem]
        });

        return newCartItem;
      }

    } catch (error) {
      console.log(error)
    }
  },

  deleteCart: async (parent, args, {userId}, info) => {
    const { id } = args;

    //check user log in
    if(!userId){
      throw new Error("Please Log in");
    }
    //find cart from given id
    const cart = await CartItem.findById(id);
    
    //find user
    const user = await User.findById(userId);

    //cheack ownership of cart
    if(cart.user.toString() !== userId){
      throw new Error("Not Authorize.");
    }

    //delete cart
    const deletedCart = await CartItem.findOneAndDelete(id);

    const updatedUserCarts = user.carts.filter(
      cartId => cartId.toString() !== deletedCart.id.toString()
    );
    await User.findByIdAndUpdate(userId, {carts: updatedUserCarts});

    return deletedCart;
  }
}

export default Mutation
