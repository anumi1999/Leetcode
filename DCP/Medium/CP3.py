# Given the root to a binary tree, implement serialize(root), which serializes the tree into a string, and deserialize(s), which deserializes the string back into the tree.
# Test case:
# node = Node('root', Node('left', Node('left.left')), Node('right'))
# assert deserialize(serialize(node)).left.left.val == 'left.left' 

import pickle
import sys
Marker = sys.maxsize
class Node:
  def __init__(self, val , left = None , right = None):
    self.val = val
    self.right = right
    self.left = left
node = Node('root', Node('left', Node('left.left')), Node('right'))
def serialize( root):
  if root ==  None:
    return "null"
  return  str(root.val) + " " + serialize(root.left) + " " + serialize(root.right)
i = 0
def deserialize(s):
    global i
    if s[i:i+4] == "null":
      if i < len(s) - 5:
        i+=5
      return None
    space = s[i:].find(" ")
    sp = space + i
    node = Node(s[i:sp])
    i =sp + 1
    node.left = deserialize(s)
    node.right = deserialize(s)
    return node

deserialize(serialize(node)).left.left.val == 'left.left'
