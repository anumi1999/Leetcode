#include<bits/stdc++.h>
using namespace std;
const int A_S = 26;

struct TrieNode{
    TrieNode *children[A_S];
    bool endofword;
};
TrieNode *getNewNode(){
    TrieNode *child = new TrieNode;
    child -> endofword = false;
    for( int i = 0 ; i < A_S ; i++ ){
            child -> children[i] = nullptr;
    }
    return child;
}
void insert_in_trie( TrieNode* head , string s){
    cout << "Inserting "<< s << ": "  ;
    TrieNode* temp = head;
    for( int i = 0 ; i < s.length() ; i++ ){
        int index = s[i] - 'A';
        cout << index << " " ;
        if( !temp->children[index]){
            temp->children[index] = getNewNode();
        }
        temp = temp->children[index];
    }
    cout << "\n";
    temp->endofword = true;
}
bool search_in_trie( TrieNode* head , string key){
    TrieNode* temp = head;
    for( int i = 0 ; i < key.length() ; i++ ){
        int index = key[i] - 'A';
        if( temp->children[index] != nullptr){
            temp = temp->children[index];
        }else{
            return false;
        }
    }
    return (temp->endofword);
}
vector<string> sol;
void form_string( TrieNode *root , string key ){
    if( root->endofword == true ){
        sol.push_back(key);
    }
    int cnt = 0;
    for( int i = 0 ; i < A_S ; i++){
        if( root->children[i] == nullptr ){
            cnt ++;
        }
    }
    if(cnt == A_S){
        return;
    }
    for( int i = 0 ; i < A_S ; i++){
        if( root->children[i] != nullptr ){
            key.push_back( 65 + i );
            form_string( root->children[i] , key);
            key.pop_back();
        }
    }
}
bool allStrings( TrieNode* head , string key){
    TrieNode* temp = head;
    for( int i = 0 ; i < key.length() ; i++ ){
        int index = key[i] - 'A';
        if( temp->children[index] != nullptr){
            temp = temp->children[index];
        }else{
            return false;
        }
    }
    if( temp->endofword ){
        sol.push_back(key);
    }
    for( int i = 0 ; i < A_S ; i++){
        if( temp->children[i] != nullptr ){
            key.push_back(65+i);
            form_string(temp->children[i] , key );
            key.pop_back();
        }
    }
    return true;
}
int main(){
    string arr[] = {"DOGS" , "DONT" , "DOES" , "DOGMATIC", "BOYS", "BOYFRIEND" , "CAT" , "CATHEDRAL"};
    TrieNode* head = new TrieNode;
    head = getNewNode();
    int n = 8;
    for( int i = 0 ; i < n ; i++ ){
        insert_in_trie(head , arr[i]);
    }
    if( allStrings(head , "DO")){
        for( auto i : sol ){
            cout << i << endl;
        }
    }
    return 0;
}
