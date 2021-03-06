import { productIndex } from "../algolia";
import { pubsub, PRODUCT_CREATED } from '../resolvers';

export default {
  Query: {
    product: async (parent, args, { Product }) => {
      const product = await Product.findOne({ _id: args._id });
      return product;
    },
    allProducts: async (parent, args, { Product }) => {
      const products = await Product.find();
      return products;
    }
  },
  Mutation: {
    createProduct: async (parent, { productInput }, { user, Product, Vendor }) => {

      if(user) {
        const product = await new Product(productInput).save();
        await Vendor.findOneAndUpdate({ user: user.user._id }, {
          $push: { products: product }
        }, { new: true });

        product._id = product._id.toString();
        pubsub.publish(PRODUCT_CREATED, { productCreated: product });
        const productObj = {
          product,
          objectID: product._id
        };
        productIndex.addObject(productObj, (err, content) => {
          if (err) {
            console.log(err);
          }
        });
        return product;

      }
      // const product = await new Product(productInput).save();

      // await Vendor.findByIdAndUpdate({ _id: productInput.vendor }, {
      //   $push: { products: product }
      // }, { new: true })

      // product._id = product._id.toString();
      // pubsub.publish(PRODUCT_CREATED, { productCreated: product });
      // const productObj = {
      //   product,
      //   objectID: product._id
      // };
      // productIndex.addObject(productObj, (err, content) => {
      //   if (err) {
      //     console.log(err);
      //   }
      // });
      return null;
    },
    updateProduct: async (parent, args, { Product }) => {
      const product = await Product.findOneAndUpdate(
        { _id: args._id },
        args.productInput,
        { new: true }
      );

      const productObj = {
        product,
        objectID: product._id
      };

      productIndex.saveObject(productObj, (err, content) => {
        if (err) {
          console.log(err);
        }

        console.log(content);
      });
      console.log(product);
      return product;
    },
    removeProduct: async (parent, args, { Product, Vendor }) => {
      const product = await Product.findByIdAndRemove({ _id: args._id });

      await Vendor.findByIdAndUpdate({ _id: product.vendor }, {
        $pull: { products: product }
      })

      await productIndex.deleteObject(product._id);

      return product;
    }
  },
  Product: {
    vendor: async (product, _, { Vendor }) => {
      if (product.vendor) {
        const vendor = await Vendor.findById({ _id: product.vendor });
        return vendor;
      }
    },
    inOrderInfoes: async (product, _, { OrderInfo }) => {
      const orderInfoes = await OrderInfo.find({ product: product._id });
      console.log(orderInfoes);

      return orderInfoes;
    },
    images: async (product, _, { Picture }) => {
      const images = await Picture.find({ product: product._id });
      console.log(images);
      return images;
    }
  }
};