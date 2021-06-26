#include<bits/stdc++.h>
using namespace std;
const int A_S = 26;

struct TrieNode{
    TrieNode *children[A_S];
    bool end_of ;
};
TrieNode* getNewNode(){
    TrieNode *child = new TrieNode;
    child -> end_of = false;
    for( int i = 0 ; i < A_S ; i++ ){
            child -> children[i] = nullptr;
    }
    return child;
}
void insert_in_trie(TrieNode* head , string s){
    TrieNode* temp = head;
    for(int i = 0 ; i < s.size() ; i++ ){
        int index = s[i] - 'A';
        if( temp->children[index] == nullptr ){
            temp->children[index] = getNewNode();
        }
        temp = temp->children[index];
    }
    temp->end_of = true;
}
vector<string> sol;
bool find_sen(TrieNode* head , string s){
    TrieNode* temp = head;
    string word = "";
    for(int i = 0 ; i < s.size() ; i++ ){
        int index = s[i] - 'A';
        if( !temp->children[index]){
            return false;
        }
        temp = temp->children[index];
        if( temp->end_of ){
            word += s[i];
            sol.push_back(word);
            word = "";
            temp = head;
        }
        else{
            word += s[i];
        }
    }
    return true;
}
int main(){
    string arr[] = {"BED" , "BATH" , "BEDBATH" , "AND" , "BEYOND" };
    string s = "BEDBATHANDBEYOND";
    TrieNode* head = new TrieNode;
    head = getNewNode();
    int n = 5;
    for( int i = 0 ; i < n ; i++ ){
        insert_in_trie(head , arr[i]);
    }
    if( find_sen(head , s)){
        for( auto i : sol ){
            cout << i << endl;
        }
    }
    return 0;
}
