void tower_of_hanoi(int n , int from , int to , int aux ){
    if( n == 1 ){
        cout << "Move disc 1 from " << from << " to " << to << endl;
        return;
    }
    tower_of_hanoi( n -1 , to , aux , from );
    cout << "Move disc " << n << " from " << from << " to " << to << endl;
    tower_of_hanoi( n - 1 , aux , to , from );
}
int main(){
    tower_of_hanoi( 3 , 1 , 3 , 2 );
    return 0;
}
