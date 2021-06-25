#include<bits/stdc++.h>
using namespace std;
const int A_S = 26;
int main(){
    vector<int> time_counter;
    time_counter.resize(1000 , 0);
    int mat[3][2] = { {30,75} , {0 , 50} , { 60 , 150 } };
    for( int i = 0 ; i < 3 ; i++ ){
        time_counter[mat[i][0]] += 1;
        time_counter[mat[i][1]] -= 1;
    }

    int rooms = 0 , temp = 0;
    for( int i = 0 ; i < 1000 ; i++ ){
        temp += time_counter[i];
        if( temp > rooms ){
            rooms = temp;
        }
    }
    cout << rooms;
    return 0;
}
